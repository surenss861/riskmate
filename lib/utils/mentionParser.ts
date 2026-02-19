/**
 * Mention parsing, formatting, and rendering utilities for comments.
 * Supports @mention syntax and optional user ID extraction for notifications.
 */

const MENTION_REGEX = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g
const AT_NAME_REGEX = /@(\w+(?:\s+\w+)*)/g

export interface MentionSpan {
  type: 'text' | 'mention'
  text: string
  userId?: string
  displayName?: string
}

/**
 * Parse body text that may contain mention markers @[Display Name](userId).
 * Returns segments for display: text and mention spans with userId and displayName.
 */
export function parseMentions(body: string): MentionSpan[] {
  if (!body || typeof body !== 'string') return [{ type: 'text', text: '' }]
  const segments: MentionSpan[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  const re = new RegExp(MENTION_REGEX.source, 'g')
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: 'text', text: body.slice(lastIndex, m.index) })
    }
    segments.push({
      type: 'mention',
      text: m[0],
      userId: m[2],
      displayName: m[1],
    })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', text: body.slice(lastIndex) })
  }
  return segments.length ? segments : [{ type: 'text', text: body }]
}

/**
 * Extract user IDs from body that contains @[Name](userId) markers.
 * Used for persisting mentions and sending notifications.
 */
export function extractMentionUserIds(body: string): string[] {
  if (!body || typeof body !== 'string') return []
  const ids: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(MENTION_REGEX.source, 'g')
  while ((m = re.exec(body)) !== null) {
    if (m[2] && !ids.includes(m[2])) ids.push(m[2])
  }
  return ids
}

/**
 * Format a mention for storage: @[Display Name](userId).
 * Use when inserting a mention into plain text (e.g. from a mention picker).
 */
export function formatMention(displayName: string, userId: string): string {
  const safe = (displayName || '').replace(/\]/g, '\\]').trim() || 'User'
  return `@[${safe}](${userId})`
}

/**
 * Convert plain @Name segments to @[Name](userId) if a mapping is provided.
 * Useful when the user types @Name and you have a name->id map from search.
 */
export function applyMentionMap(
  body: string,
  nameToId: Record<string, string>
): string {
  if (!body || typeof body !== 'string') return body
  return body.replace(AT_NAME_REGEX, (match, name) => {
    const key = name.trim()
    const id = nameToId[key]
    if (id) return formatMention(key, id)
    return match
  })
}

/**
 * Render parsed segments to a string suitable for plain text (e.g. notifications).
 * Mentions are rendered as @displayName.
 */
export function renderMentionsToPlainText(segments: MentionSpan[]): string {
  return segments
    .map((s) => (s.type === 'mention' ? `@${s.displayName ?? s.userId}` : s.text))
    .join('')
}

/**
 * Render parsed segments to HTML-like string for rich display (optional).
 * Mention spans can be wrapped in a data attribute for styling or links.
 */
export function renderMentionsToHtml(segments: MentionSpan[]): string {
  return segments
    .map((s) => {
      if (s.type === 'mention') {
        const name = (s.displayName ?? s.userId ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const id = (s.userId ?? '').replace(/"/g, '&quot;')
        return `<span data-mention data-user-id="${id}">@${name}</span>`
      }
      return (s.text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    })
    .join('')
}
