/**
 * Extract user IDs from text containing @[Display Name](userId) markers and/or plain @mentions.
 * Plain @name / @email patterns are resolved to user IDs by looking up users in the caller's organization.
 * Matches frontend lib/utils/mentionParser.ts contract (AT_NAME_REGEX-style) for notifications.
 */
import { supabase } from "../lib/supabaseClient";

const MENTION_REGEX = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
/** Plain @mention: @name or @first last (same as frontend AT_NAME_REGEX). */
const AT_NAME_REGEX = /@(\w+(?:\s+\w+)*)/g;
/** Plain @email for addresses like user@example.com. */
const AT_EMAIL_REGEX = /@([^\s@]+@[^\s@]+)/g;

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
  const tokens = new Set<string>();
  let m: RegExpExecArray | null;
  const nameRe = new RegExp(AT_NAME_REGEX.source, "g");
  while ((m = nameRe.exec(body)) !== null) {
    if (m[1]?.trim()) tokens.add(m[1].trim());
  }
  const emailRe = new RegExp(AT_EMAIL_REGEX.source, "g");
  while ((m = emailRe.exec(body)) !== null) {
    if (m[1]?.trim()) tokens.add(m[1].trim());
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
      const matched =
        email === t ||
        name === t ||
        (name && name.includes(t)) ||
        (name && name.split(/\s+/).some((p: string) => p === t));
      if (matched) {
        resolved.add((u as { id: string }).id);
        break;
      }
    }
  }
  return [...resolved];
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
