/**
 * Extract user IDs from text containing @[Display Name](userId) markers and/or plain @mentions.
 * Plain @name / @email patterns are resolved to user IDs by looking up users in the caller's organization.
 * Matches frontend lib/utils/mentionResolverServer.ts: only tokens of safe length, not contained in emails,
 * and exact (case-insensitive) full_name or email match only.
 */
import { supabase } from "../lib/supabaseClient";

const MENTION_REGEX = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
/** Plain @mention: @name or @first last (same as frontend AT_NAME_REGEX). */
const AT_NAME_REGEX = /@(\w+(?:\s+\w+)*)/g;
/** Plain @email for addresses like user@example.com. */
const AT_EMAIL_REGEX = /@([^\s@]+@[^\s@]+)/g;

/** Minimum length for a name-like token to be considered (avoids @ab, @x matching). */
const MIN_TOKEN_LENGTH = 3;

function extractMarkedMentionIds(body: string): string[] {
  if (!body || typeof body !== "string") return [];
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_REGEX.source, "g");
  while ((m = re.exec(body)) !== null) {
    if (m[2] && !ids.includes(m[2])) ids.push(m[2]);
  }
  return ids;
}

function extractPlainMentionTokens(body: string): string[] {
  if (!body || typeof body !== "string") return [];
  const nameTokens = new Set<string>();
  const emailTokens = new Set<string>();
  let m: RegExpExecArray | null;
  const nameRe = new RegExp(AT_NAME_REGEX.source, "g");
  while ((m = nameRe.exec(body)) !== null) {
    const t = m[1]?.trim();
    if (t) nameTokens.add(t);
  }
  const emailRe = new RegExp(AT_EMAIL_REGEX.source, "g");
  while ((m = emailRe.exec(body)) !== null) {
    const t = m[1]?.trim();
    if (t) emailTokens.add(t);
  }
  const tokens = new Set<string>();
  for (const t of emailTokens) tokens.add(t);
  for (const t of nameTokens) {
    if (t.length < MIN_TOKEN_LENGTH) continue;
    if (t.includes("@")) continue;
    const isContainedInEmail = [...emailTokens].some((e) => e.includes(t));
    if (isContainedInEmail) continue;
    tokens.add(t);
  }
  return [...tokens];
}

async function resolvePlainMentionsToUserIds(
  tokens: string[],
  organizationId: string
): Promise<string[]> {
  if (tokens.length === 0) return [];

  let orgUserIds: string[] = [];
  const { data: memberRows } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId);
  orgUserIds = (memberRows || []).map((r: { user_id: string }) => r.user_id);
  if (orgUserIds.length === 0) {
    const { data: usersInOrg } = await supabase
      .from("users")
      .select("id")
      .eq("organization_id", organizationId);
    orgUserIds = (usersInOrg || []).map((u: { id: string }) => u.id);
  }
  if (orgUserIds.length === 0) return [];

  const { data: usersData } = await supabase
    .from("users")
    .select("id, email, full_name")
    .in("id", orgUserIds);

  const resolved = new Set<string>();
  const normalized = (s: string) => (s || "").toLowerCase().trim();
  for (const token of tokens) {
    const t = normalized(token);
    if (!t) continue;
    for (const u of usersData || []) {
      const email = normalized((u as { email?: string }).email || "");
      const name = normalized((u as { full_name?: string }).full_name || "");
      const matched = email === t || name === t;
      if (matched) {
        resolved.add((u as { id: string }).id);
        break;
      }
    }
  }
  return [...resolved];
}

/** Format a mention for storage: @[Display Name](userId). */
export function formatMention(displayName: string, userId: string): string {
  const safe = (displayName || "").replace(/\]/g, "\\]").trim() || "User";
  return `@[${safe}](${userId})`;
}

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
export function contentToMentionTokenFormat(
  content: string,
  users: MentionTokenUser[]
): string {
  if (!content || typeof content !== "string") return content;
  if (!Array.isArray(users) || users.length === 0) return content;

  const normalized = (s: string) => (s || "").toLowerCase().trim();
  const tokenToReplacement = new Map<string, string>();
  for (const u of users) {
    const displayName = (u.full_name ?? "").trim() || u.id;
    const replacement = formatMention(displayName, u.id);
    if ((u.email ?? "").trim()) tokenToReplacement.set(normalized(u.email!), replacement);
    if ((u.full_name ?? "").trim()) {
      tokenToReplacement.set(normalized(u.full_name!), replacement);
      tokenToReplacement.set((u.full_name ?? "").trim(), replacement);
    }
  }

  const plainNameOrEmailRegex = /@(?!\[)(\w+(?:\s+\w+)*)|@(?!\[)([^\s@]+@[^\s@]+)/g;
  return content.replace(
    plainNameOrEmailRegex,
    (match, namePart: string | undefined, emailPart: string | undefined) => {
      const token = (namePart ?? emailPart ?? "").trim();
      if (!token) return match;
      const replacement = tokenToReplacement.get(token) ?? tokenToReplacement.get(normalized(token));
      return replacement ?? match;
    }
  );
}

/**
 * Extract user IDs from body: @[Name](userId) markers plus plain @name / @email when organizationId is provided.
 * When organizationId is provided, plain mentions are looked up in that organization and resolved to user IDs.
 */
export async function extractMentionUserIds(
  body: string,
  organizationId?: string
): Promise<string[]> {
  if (!body || typeof body !== "string") return [];
  const fromMarkers = extractMarkedMentionIds(body);
  if (!organizationId) {
    return fromMarkers;
  }
  const plainTokens = extractPlainMentionTokens(body);
  const fromPlain = await resolvePlainMentionsToUserIds(plainTokens, organizationId);
  return [...new Set([...fromMarkers, ...fromPlain])];
}
