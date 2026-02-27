/**
 * SSRF-safe webhook URL validation (defense-in-depth): reject localhost, loopback,
 * private, link-local, CGNAT, multicast, and reserved ranges. Resolves DNS (A/AAAA)
 * and rejects if any resolved address is non-public. Used before sending in the worker
 * to mitigate DNS rebinding between endpoint creation and delivery.
 */

import { promises as dns } from 'node:dns'

export type WebhookUrlResult =
  | { valid: true }
  | { valid: false; reason: string }

/**
 * Returns whether the URL is allowed for webhook delivery.
 * Resolves hostnames and rejects if any resolved IP is private/loopback/link-local/CGNAT/multicast.
 * Call before fetch() in the worker to re-validate at send-time.
 */
export async function validateWebhookUrl(urlString: string): Promise<WebhookUrlResult> {
  try {
    const u = new URL(urlString)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed' }
    }
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev && u.protocol !== 'https:') {
      return { valid: false, reason: 'HTTPS is required outside local development' }
    }
    const hostname = u.hostname.toLowerCase()
    if (isBlockedHostname(hostname)) {
      return { valid: false, reason: 'Webhook URL must point to a public destination' }
    }
    const resolvedBlocked = await resolveAndCheckAddresses(hostname)
    if (resolvedBlocked) {
      return { valid: false, reason: 'Webhook URL must point to a public destination' }
    }
    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid URL' }
  }
}

/**
 * If hostname is a literal IP, check it; otherwise resolve A/AAAA and check all addresses.
 * Returns true if any address is blocked (private/loopback/link-local/CGNAT/multicast).
 */
async function resolveAndCheckAddresses(hostname: string): Promise<boolean> {
  if (isLiteralIpv4(hostname) || isLiteralIpv6(hostname)) {
    return isBlockedIp(hostname)
  }
  const addresses: string[] = []
  try {
    const [v4, v6] = await Promise.all([
      dns.resolve4(hostname).catch(() => [] as string[]),
      dns.resolve6(hostname).catch(() => [] as string[]),
    ])
    addresses.push(...v4, ...v6)
  } catch {
    return true
  }
  if (addresses.length === 0) return true
  return addresses.some((addr) => isBlockedIp(addr))
}

function isLiteralIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((p) => parseInt(p, 10))
  return !octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)
}

function isLiteralIpv6(host: string): boolean {
  return host.includes(':')
}

function isBlockedHostname(host: string): boolean {
  if (host === 'localhost' || host === '0.0.0.0') return true
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host === 'metadata.google.internal' || host === 'metadata') return true
  return false
}

function isBlockedIp(host: string): boolean {
  if (host.includes(':')) {
    return isBlockedIpv6(host)
  }
  return isBlockedIpv4(host)
}

function isBlockedIpv4(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((p) => parseInt(p, 10))
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  const [a, b] = octets
  if (a === 0) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224 && a <= 239) return true
  return false
}

function isBlockedIpv6(host: string): boolean {
  const normalized = host.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('fe80:')) return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('ff')) return true
  if (normalized.startsWith('::ffff:')) {
    const tail = normalized.slice(7)
    const v4 = tail.split('.')
    if (v4.length === 4) {
      const o = v4.map((p) => parseInt(p, 10))
      if (!o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
        return isBlockedIpv4(tail)
      }
    }
  }
  return false
}
