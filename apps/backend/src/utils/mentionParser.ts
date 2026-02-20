/**
 * Re-export shared mention parsing from lib so backend and frontend use the same regexes,
 * token length rules, and email/name handling. Implementation lives in lib/utils/mentionParserCore.ts.
 */
import { supabase } from "../lib/supabaseClient";
import {
  extractMentionUserIds as extractMentionUserIdsFromCore,
  contentToMentionTokenFormat,
  formatMention,
  type MentionTokenUser,
} from "../../../../lib/utils/mentionParserCore";

export type { MentionTokenUser } from "../../../../lib/utils/mentionParserCore";
export { contentToMentionTokenFormat, formatMention } from "../../../../lib/utils/mentionParserCore";

/**
 * Extract user IDs from body: @[Name](userId) markers plus plain @name / @email
 * resolved via organization lookup. Uses shared core with backend's supabase client.
 */
export async function extractMentionUserIds(
  body: string,
  organizationId?: string
): Promise<string[]> {
  return extractMentionUserIdsFromCore(body, organizationId, supabase);
}
