/**
 * Public API Key Authentication Middleware
 *
 * Extracts Bearer token (rm_live_xxx or rm_test_xxx), hashes with SHA-256,
 * looks up in api_keys table, checks revoked/expired, updates last_used_at,
 * and attaches organization context to the request.
 */

import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

const KEY_PREFIX_LIVE = 'rm_live_'
const KEY_PREFIX_TEST = 'rm_test_'

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
 * Check if the request is using API key auth (Bearer rm_live_... or rm_test_...)
 */
export function getBearerApiKey(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.slice(7).trim()
  if (token.startsWith(KEY_PREFIX_LIVE) || token.startsWith(KEY_PREFIX_TEST)) return token
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

/**
 * Authenticate request via API key and return context.
 * Returns null if no API key, invalid key, revoked, or expired.
 * On success, caller should update last_used_at (e.g. in route handler after scope check).
 */
export async function getApiKeyContext(request: NextRequest): Promise<{
  context: ApiKeyContext
  keyRow: { id: string; organization_id: string; scopes: string[] }
} | null> {
  const plainKey = getBearerApiKey(request)
  if (!plainKey) return null

  const keyHash = hashApiKey(plainKey)
  const admin = createSupabaseAdminClient()

  const { data: keyRow, error } = await admin
    .from('api_keys')
    .select('id, organization_id, scopes, revoked_at, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error || !keyRow) return null
  if (keyRow.revoked_at) return null
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) return null

  return {
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
