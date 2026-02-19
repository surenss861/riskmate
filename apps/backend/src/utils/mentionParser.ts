/**
 * Extract user IDs from text containing @[Display Name](userId) markers.
 * Matches frontend lib/utils/mentionParser.ts contract for notifications.
 */
const MENTION_REGEX = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;

export function extractMentionUserIds(body: string): string[] {
  if (!body || typeof body !== "string") return [];
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_REGEX.source, "g");
  while ((m = re.exec(body)) !== null) {
    if (m[2] && !ids.includes(m[2])) ids.push(m[2]);
  }
  return ids;
}
