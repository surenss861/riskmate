/**
 * Single source of truth for mention parsing and formatting (no React).
 * Used by apps/backend and lib/utils/mentionResolverServer so regexes, token length rules,
 * and email/name handling stay consistent across create/edit flows and notifications.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
export declare const MENTION_REGEX: RegExp;
/** Plain @mention: @name or @first last. */
export declare const AT_NAME_REGEX: RegExp;
/** Plain @email for addresses like user@example.com. */
export declare const AT_EMAIL_REGEX: RegExp;
/** Minimum length for a name-like token to be considered (avoids @ab, @x matching). */
export declare const MIN_TOKEN_LENGTH = 3;
/**
 * Extract plain @name / @email tokens with strict filtering (min length, not contained in emails).
 */
export declare function extractPlainMentionTokens(body: string): string[];
/** Format a mention for storage: @[Display Name](userId). */
export declare function formatMention(displayName: string, userId: string): string;
/** User shape for contentToMentionTokenFormat (id, full_name, email for matching and display). */
export interface MentionTokenUser {
    id: string;
    full_name?: string | null;
    email?: string | null;
}
/**
 * Convert content to mention-token format so that every resolved mention is persisted as @[Display Name](userId).
 * Leaves existing @[Name](id) segments unchanged; replaces plain @name / @email with @[Display Name](userId).
 */
export declare function contentToMentionTokenFormat(content: string, users: MentionTokenUser[]): string;
/**
 * Parse content for @[Display Name](userId) markers and return mentioned user IDs.
 */
export declare function parseMentions(content: string): string[];
/**
 * Extract user IDs from body: @[Name](userId) markers plus plain @name / @email when
 * organizationId and supabase are provided. When supabase is not provided, returns only marked IDs.
 */
export declare function extractMentionUserIds(body: string, organizationId?: string, supabase?: SupabaseClient): Promise<string[]>;
//# sourceMappingURL=mentionParserCore.d.ts.map