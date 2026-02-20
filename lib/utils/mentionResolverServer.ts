/**
 * Server-only: resolve @mentions in comment body to user IDs within the caller's organization.
 * Extracts IDs from @[Display Name](userId) markers and resolves plain @name / @email tokens
 * by looking up users in the given organization. Port of apps/backend/src/utils/mentionParser.ts.
 */

import { parseMentions } from '@/lib/utils/mentionParser'
import type { SupabaseClient } from '@supabase/supabase-js'

const AT_NAME_REGEX = /@(\w+(?:\s+\w+)*)/g
const AT_EMAIL_REGEX = /@([^\s@]+@[^\s@]+)/g

function extractPlainMentionTokens(body: string): string[] {
  if (!body || typeof body !== 'string') return []
  const tokens = new Set<string>()
  let m: RegExpExecArray | null
  const nameRe = new RegExp(AT_NAME_REGEX.source, 'g')
  while ((m = nameRe.exec(body)) !== null) {
    if (m[1]?.trim()) tokens.add(m[1].trim())
  }
  const emailRe = new RegExp(AT_EMAIL_REGEX.source, 'g')
  while ((m = emailRe.exec(body)) !== null) {
    if (m[1]?.trim()) tokens.add(m[1].trim())
  }
  return [...tokens]
}

async function resolvePlainMentionsToUserIds(
  supabase: SupabaseClient,
  tokens: string[],
  organizationId: string
): Promise<string[]> {
  if (tokens.length === 0) return []

  let orgUserIds: string[] = []
  const { data: memberRows } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
  orgUserIds = (memberRows || []).map((r: { user_id: string }) => r.user_id)
  if (orgUserIds.length === 0) {
    const { data: usersInOrg } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId)
    orgUserIds = (usersInOrg || []).map((u: { id: string }) => u.id)
  }
  if (orgUserIds.length === 0) return []

  const { data: usersData } = await supabase
    .from('users')
    .select('id, email, full_name')
    .in('id', orgUserIds)

  const resolved = new Set<string>()
  const normalized = (s: string) => (s || '').toLowerCase().trim()
  for (const token of tokens) {
    const t = normalized(token)
    if (!t) continue
    for (const u of usersData || []) {
      const email = normalized((u as { email?: string }).email || '')
      const name = normalized((u as { full_name?: string }).full_name || '')
      const matched =
        email === t ||
        name === t ||
        (name && name.includes(t)) ||
        (name && name.split(/\s+/).some((p: string) => p === t))
      if (matched) {
        resolved.add((u as { id: string }).id)
        break
      }
    }
  }
  return [...resolved]
}

/**
 * Extract user IDs from body: @[Name](userId) markers plus plain @name / @email
 * resolved to user IDs within the given organization. Resolved IDs are implicitly
 * scoped to the org (resolution only considers org members). Caller should still
 * filter to org before insert/update if combining with other sources.
 */
export async function resolveMentionUserIds(
  supabase: SupabaseClient,
  body: string,
  organizationId: string
): Promise<string[]> {
  if (!body || typeof body !== 'string') return []
  const fromMarkers = parseMentions(body)
  const plainTokens = extractPlainMentionTokens(body)
  const fromPlain = await resolvePlainMentionsToUserIds(supabase, plainTokens, organizationId)
  return [...new Set([...fromMarkers, ...fromPlain])]
}
