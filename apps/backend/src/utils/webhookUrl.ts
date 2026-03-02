/**
 * SSRF-safe webhook URL validation: reject localhost, loopback, private,
 * link-local, CGNAT, multicast, and reserved ranges; enforce HTTPS outside local development.
 * Resolves DNS (A/AAAA) and rejects if any resolved address is non-public to prevent
 * DNS rebinding and hostnames that resolve to internal IPs.
 * IPv4-mapped IPv6 (including hex forms like ::ffff:7f00:1) are normalized and checked.
 *
 * Canonical source: lib/utils/webhookUrl.ts. Keep in sync with that file (CI checks identity).
 */

import { promises as dns } from 'node:dns'
import { isIP } from 'node:net'

export type WebhookUrlResult =
  | WebhookUrlValidationSuccess
  | { valid: false; reason: string; terminal: true }   // explicit policy (SSRF/blocked destination) — do not retry
  | { valid: false; reason: string; terminal: false } // transient (DNS/lookup/runtime) — allow retries

/** When valid: true, contains resolution details so the caller can pin the outbound connection to the vetted IP (prevents DNS rebinding). */
export type WebhookUrlValidationSuccess = {
  valid: true
  /** Original hostname (for Host header and TLS SNI / certificate verification). */
  hostname: string
  /** Resolved IP to connect to; request must be sent to this address only. */
  resolvedAddress: string
  port: number
  protocol: 'http' | 'https'
  /** pathname + search for the request. */
  path: string
  /** Value for the Host header (e.g. "example.com" or "example.com:8443"). */
  hostHeader: string
}

/**
 * Returns whether the URL is allowed for webhook endpoints.
 * Resolves hostnames and rejects if any resolved IP is private/loopback/link-local/CGNAT/multicast.
 * When valid, returns resolution details so the caller can pin the outbound connection to the vetted IP.
 */
export async function validateWebhookUrl(urlString: string): Promise<WebhookUrlResult> {
  try {
    const u = new URL(urlString)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed', terminal: true }
    }
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev && u.protocol !== 'https:') {
      return { valid: false, reason: 'HTTPS is required outside local development', terminal: true }
    }
    let hostname = u.hostname.toLowerCase()
    if (hostname.startsWith('[') && hostname.endsWith(']')) hostname = hostname.slice(1, -1)
    if (isBlockedHostname(hostname)) {
      return { valid: false, reason: 'Webhook URL must point to a public destination', terminal: true }
    }
    const resolution = await resolveAndCheckAddresses(hostname)
    if (resolution === 'policy') {
      return { valid: false, reason: 'Webhook URL must point to a public destination', terminal: true }
    }
    if (resolution === 'transient') {
      return { valid: false, reason: 'Webhook URL must point to a public destination', terminal: false }
    }
    const addresses = resolution.addresses
    const resolvedAddress = addresses[0]
    const protocol = u.protocol === 'https:' ? 'https' : 'http'
    const port = u.port ? parseInt(u.port, 10) : (protocol === 'https' ? 443 : 80)
    const path = u.pathname + u.search
    const hostHeader = u.port ? `${hostname}:${u.port}` : hostname
    return {
      valid: true,
      hostname,
      resolvedAddress,
      port,
      protocol,
      path,
      hostHeader,
    }
  } catch {
    // Parse/format failure: malformed URL is not transient — fail fast, do not retry.
    return { valid: false, reason: 'Invalid URL', terminal: true }
  }
}

/**
 * If hostname is a literal IP (or IPv4-mapped IPv6), check it; otherwise resolve A/AAAA and check all addresses.
 * Returns 'policy' when destination is explicitly blocked (private/loopback/reserved) — terminal, no retry.
 * Returns 'transient' when DNS resolution fails or no addresses returned — allow retries.
 * Returns { allowed: true, addresses } with the list of allowed resolved IPs for pinning.
 */
async function resolveAndCheckAddresses(
  hostname: string
): Promise<{ allowed: true; addresses: string[] } | 'policy' | 'transient'> {
  const mappedV4 = getIpv4MappedDottedDecimal(hostname)
  if (mappedV4 !== null) {
    return isBlockedIp(hostname) ? 'policy' : { allowed: true, addresses: [mappedV4] }
  }
  if (isLiteralIpv4(hostname) || isLiteralIpv6(hostname)) {
    return isBlockedIp(hostname) ? 'policy' : { allowed: true, addresses: [hostname] }
  }
  const addresses: string[] = []
  try {
    const [v4, v6] = await Promise.all([
      dns.resolve4(hostname).catch(() => [] as string[]),
      dns.resolve6(hostname).catch(() => [] as string[]),
    ])
    addresses.push(...v4, ...v6)
  } catch {
    return 'transient'
  }
  if (addresses.length === 0) return 'transient'
  if (addresses.some((addr) => isBlockedIp(addr))) return 'policy'
  return { allowed: true, addresses }
}

function isLiteralIpv4(host: string): boolean {
  return isIP(host) === 4
}

function isLiteralIpv6(host: string): boolean {
  return isIP(host) === 6
}

function isBlockedHostname(host: string): boolean {
  if (host === 'localhost' || host === '0.0.0.0') return true
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === 'metadata.google.internal' || host === 'metadata') return true
  if (host === 'instance-data' || host === 'instance-data.ec2.internal') return true
  if (host === 'metadata.azure.internal' || host === 'metadata.azure.com') return true
  if (host.endsWith('.ec2.internal') || host.endsWith('.compute.internal')) return true
  return false
}

function isBlockedIp(host: string): boolean {
  if (isIP(host) === 6) return isBlockedIpv6(host)
  if (isIP(host) === 4) return isBlockedIpv4(host)
  return false
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((p) => parseInt(p, 10))
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  const [a, b, c] = octets
  if (a === 0) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224 && a <= 239) return true
  if (a >= 240) return true
  if (a === 198 && b >= 18 && b <= 19) return true
  if (a === 192 && b === 0 && c === 0) return true
  if (a === 192 && b === 0 && c === 2) return true
  if (a === 198 && b === 51 && c === 100) return true
  if (a === 203 && b === 0 && c === 113) return true
  return false
}

/**
 * Expand IPv6 string to 8 x 16-bit groups (decimal). Returns null if not valid IPv6.
 * Handles :: compression by splitting on :: once, expanding each half, and padding the middle with zeros.
 */
function expandIpv6ToGroups(host: string): number[] | null {
  const normalized = host.toLowerCase().trim()
  if (normalized === '::') return [0, 0, 0, 0, 0, 0, 0, 0]
  if (normalized.includes('.')) return null
  const segments = normalized.split('::')
  if (segments.length > 2) return null
  if (segments.length === 1) {
    const parts = normalized.split(':')
    if (parts.length !== 8) return null
    const parsed = parts.map((p) => parseInt(p, 16))
    if (parsed.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null
    return parsed
  }
  const [leftStr, rightStr] = segments
  const leftParts = leftStr ? leftStr.split(':').filter(Boolean) : []
  const rightParts = rightStr ? rightStr.split(':').filter(Boolean) : []
  const left = leftParts.map((p) => parseInt(p, 16))
  const right = rightParts.map((p) => parseInt(p, 16))
  if (left.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null
  if (right.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null
  const total = left.length + right.length
  if (total > 8) return null
  const zerosNeeded = 8 - total
  return [...left, ...Array(zerosNeeded).fill(0), ...right]
}

/**
 * If host is an IPv4-mapped IPv6 address (any form: dotted or hex), return the
 * canonical IPv4 dotted-decimal string; otherwise null.
 */
function getIpv4MappedDottedDecimal(host: string): string | null {
  const normalized = host.toLowerCase().trim()
  if (normalized.startsWith('::ffff:')) {
    const tail = normalized.slice(7)
    const v4 = tail.split('.')
    if (v4.length === 4) {
      const o = v4.map((p) => parseInt(p, 10))
      if (!o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return tail
    }
  }
  const groups = expandIpv6ToGroups(host)
  if (!groups) return null
  const isStandardMapped =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff
  const isAlternateMapped =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0xffff &&
    groups[5] === 0
  if (!isStandardMapped && !isAlternateMapped) return null
  const hi = groups[6]
  const lo = groups[7]
  const addr = (hi << 16) | lo
  const a = (addr >>> 24) & 0xff
  const b = (addr >>> 16) & 0xff
  const c = (addr >>> 8) & 0xff
  const d = addr & 0xff
  return `${a}.${b}.${c}.${d}`
}

/**
 * Block IPv6 by normalized address semantics (not string prefixes) so expanded
 * forms like 0:0:0:0:0:0:0:1 cannot bypass loopback checks.
 */
function isBlockedIpv6(host: string): boolean {
  const groups = expandIpv6ToGroups(host)
  if (groups && groups.length === 8) {
    // Unspecified ::/128
    if (groups.every((g) => g === 0)) return true
    // Loopback ::1/128 (any expansion: ::1, 0:0:0:0:0:0:0:1, etc.)
    if (
      groups[0] === 0 &&
      groups[1] === 0 &&
      groups[2] === 0 &&
      groups[3] === 0 &&
      groups[4] === 0 &&
      groups[5] === 0 &&
      groups[6] === 0 &&
      groups[7] === 1
    )
      return true
    // Link-local fe80::/10
    if ((groups[0] & 0xffc0) === 0xfe80) return true
    // Unique local fc00::/7
    if ((groups[0] & 0xfe00) === 0xfc00) return true
    // Multicast ff00::/8
    if ((groups[0] & 0xff00) === 0xff00) return true
    // IPv4-mapped: check embedded IPv4
    const mappedV4 = getIpv4MappedDottedDecimal(host)
    if (mappedV4 !== null) return isBlockedIpv4(mappedV4)
    return false
  }
  // Fallback when expansion fails (edge-case invalid forms)
  const normalized = host.toLowerCase()
  if (normalized === '::') return true
  if (normalized === '::1') return true
  if (normalized.startsWith('fe80:')) return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('ff')) return true
  const mappedV4Fallback = getIpv4MappedDottedDecimal(host)
  if (mappedV4Fallback !== null) return isBlockedIpv4(mappedV4Fallback)
  return false
}
