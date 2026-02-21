export type { MentionTokenUser } from "../../../../lib/utils/mentionParserCore";
export { contentToMentionTokenFormat, formatMention } from "../../../../lib/utils/mentionParserCore";
/**
 * Extract user IDs from body: @[Name](userId) markers plus plain @name / @email
 * resolved via organization lookup. Uses shared core with backend's supabase client.
 */
export declare function extractMentionUserIds(body: string, organizationId?: string): Promise<string[]>;
//# sourceMappingURL=mentionParser.d.ts.map