/**
 * Server-only: resolve @mentions in comment body to user IDs within the caller's organization.
 * Uses lib/utils/mentionParserCore so regexes, token length rules, and email/name handling match the backend.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractMentionUserIds as extractMentionUserIdsCore,
  contentToMentionTokenFormat,
  type MentionTokenUser,
} from './mentionParserCore'

export type { MentionTokenUser } from './mentionParserCore'
export { contentToMentionTokenFormat, extractPlainMentionTokens } from './mentionParserCore'

/**
 * Extract user IDs from body: @[Name](userId) markers plus plain @name / @email
 * resolved to user IDs within the given organization. Same semantics as backend.
 */
export async function resolveMentionUserIds(
  supabase: SupabaseClient,
  body: string,
  organizationId: string
): Promise<string[]> {
  return extractMentionUserIdsCore(body, organizationId, supabase)
}
