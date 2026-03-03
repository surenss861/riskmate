/**
 * Public API Key Authentication Middleware
 *
 * Extracts Bearer token (rm_live_xxx or rm_test_xxx), hashes with SHA-256,
 * looks up in api_keys table, checks revoked/expired, updates last_used_at,
 * and attaches organization context to the request.
 * Environment-aware: production accepts only rm_live_; non-production accepts
 * rm_test_ and optionally rm_live_ when explicitly configured.
 */

import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const KEY_PREFIX_LIVE = 'rm_live_'
export const KEY_PREFIX_TEST = 'rm_test_'

/** When set in non-production, live keys are accepted for auth (e.g. testing). */
const ENV_ALLOW_LIVE_KEYS_IN_NON_PROD = 'RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD'

/**
 * Allowed prefixes for API key authentication in the current environment.
 * Production: only rm_live_. Non-production: rm_test_, and rm_live_ only if
 * RISKMATE_ALLOW_LIVE_KEYS_IN_NON_PROD is set.
 */
export function getAllowedPrefixesForAuth(): string[] {
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd) return [KEY_PREFIX_LIVE]
  const allowLive = process.env[ENV_ALLOW_LIVE_KEYS_IN_NON_PROD] === 'true' || process.env[ENV_ALLOW_LIVE_KEYS_IN_NON_PROD] === '1'
  return allowLive ? [KEY_PREFIX_TEST, KEY_PREFIX_LIVE] : [KEY_PREFIX_TEST]
}

/**
 * Default prefix for newly created API keys in the current environment.
 * Production: rm_live_; non-production: rm_test_.
 */
export function getDefaultKeyPrefix(): string {
  return process.env.NODE_ENV === 'production' ? KEY_PREFIX_LIVE : KEY_PREFIX_TEST
}

export interface ApiKeyContext {
  organization_id: string
  api_key_id: string
  scopes: string[]
}

/**
 * Hash API key with SHA-256 for lookup (same as stored key_hash).
 */
export function hashApiKey(plainKey: string): string {
  return createHash('sha256').update(plainKey, 'utf8').digest('hex')
}

/**
 * Extract prefix for display (first 8 chars of key, e.g. "rm_live_")
 */
export function getKeyPrefix(plainKey: string): string {
  if (plainKey.startsWith(KEY_PREFIX_LIVE)) return plainKey.slice(0, KEY_PREFIX_LIVE.length + 8)
  if (plainKey.startsWith(KEY_PREFIX_TEST)) return plainKey.slice(0, KEY_PREFIX_TEST.length + 8)
  return plainKey.slice(0, 12)
}

/**
 * Check if the request is using API key auth with an environment-allowed prefix.
 * Production: only Bearer rm_live_... . Non-production: rm_test_... and optionally rm_live_... if configured.
 * Authorization scheme is parsed case-insensitively per HTTP semantics.
 */
export function getBearerApiKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth) return null
  const spaceIdx = auth.indexOf(' ')
  if (spaceIdx === -1) return null
  const scheme = auth.slice(0, spaceIdx)
  if (scheme.toLowerCase() !== 'bearer') return null
  const token = auth.slice(spaceIdx + 1).trim()
  const allowed = getAllowedPrefixesForAuth()
  if (allowed.some((p) => token.startsWith(p))) return token
  return null
}

/**
 * Require one of the given scopes. Call after getApiKeyContext.
 */
export function requireScope(context: ApiKeyContext, allowed: string[]): boolean {
  for (const scope of allowed) {
    if (context.scopes.includes(scope)) return true
  }
  return false
}

/** Discriminated result of API key lookup: auth failure vs backend error vs success. */
export type GetApiKeyContextResult =
  | {
      kind: 'ok'
      context: ApiKeyContext
      keyRow: { id: string; organization_id: string; scopes: string[] }
    }
  | { kind: 'auth_failure' }
  | { kind: 'backend_error' }

/**
 * Authenticate request via API key and return context.
 * Returns auth_failure for no key, invalid key, revoked, or expired.
 * Returns backend_error for query/runtime errors so callers can return 500.
 * On success (kind: 'ok'), caller should update last_used_at (e.g. in route handler after scope check).
 */
export async function getApiKeyContext(
  request: NextRequest
): Promise<GetApiKeyContextResult> {
  const plainKey = getBearerApiKey(request)
  if (!plainKey) return { kind: 'auth_failure' }

  const keyHash = hashApiKey(plainKey)
  const admin = createSupabaseAdminClient()

  const { data: keyRow, error } = await admin
    .from('api_keys')
    .select('id, organization_id, scopes, revoked_at, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error) return { kind: 'backend_error' }
  if (!keyRow) return { kind: 'auth_failure' }
  if (keyRow.revoked_at) return { kind: 'auth_failure' }
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date())
    return { kind: 'auth_failure' }

  return {
    kind: 'ok',
    context: {
      organization_id: keyRow.organization_id,
      api_key_id: keyRow.id,
      scopes: Array.isArray(keyRow.scopes) ? keyRow.scopes : [],
    },
    keyRow: {
      id: keyRow.id,
      organization_id: keyRow.organization_id,
      scopes: Array.isArray(keyRow.scopes) ? keyRow.scopes : [],
    },
  }
}

/**
 * Update last_used_at for the API key. Callers should await this so updates
 * complete before the request ends (e.g. in serverless lifecycles).
 */
export async function touchApiKeyLastUsed(apiKeyId: string): Promise<void> {
  try {
    const admin = createSupabaseAdminClient()
    await admin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyId)
  } catch {
    // Non-fatal
  }
}
