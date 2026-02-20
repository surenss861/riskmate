/**
 * Mention parsing, formatting, and rendering utilities for comments.
 * Supports @mention syntax and optional user ID extraction for notifications.
 * Parsing/formatting (regexes, token rules, email/name) come from mentionParserCore for consistency with backend.
 */

import React from 'react'
import { MENTION_REGEX, AT_NAME_REGEX, parseMentions, formatMention } from './mentionParserCore'

export { parseMentions, formatMention } from './mentionParserCore'
export type { MentionTokenUser } from './mentionParserCore'

export interface MentionSpan {
  type: 'text' | 'mention'
  text: string
  userId?: string
  displayName?: string
}

/**
 * Parse body text that may contain mention markers @[Display Name](userId).
 * Returns segments for display: text and mention spans with userId and displayName.
 * Segment-based helper; use renderMentions(content) for raw content → React.
 */
export function parseMentionsToSegments(body: string): MentionSpan[] {
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
 * Used for persisting mentions and sending notifications. Delegates to parseMentions.
 */
export function extractMentionUserIds(body: string): string[] {
  return parseMentions(body)
}

/**
 * Detect active @mention at cursor: returns the query string after @ for autocomplete.
 * If cursor is not immediately after an @ or inside an @-mention context, returns null.
 * @param text - Full text content
 * @param cursorPos - Cursor position (0-based index)
 * @returns The query string after @ (e.g. "jo" for "@jo"), or null if no active mention
 */
export function extractMentionQuery(text: string, cursorPos: number): string | null {
  if (!text || typeof text !== 'string' || cursorPos < 0 || cursorPos > text.length) return null
  const beforeCursor = text.slice(0, cursorPos)
  const lastAt = beforeCursor.lastIndexOf('@')
  if (lastAt === -1) return null
  const afterAt = beforeCursor.slice(lastAt + 1)
  if (/[\s\n\r]/.test(afterAt)) return null
  return afterAt
}

/**
 * User shape for formatMentions (id and display name).
 */
export interface MentionUser {
  id: string
  full_name?: string | null
}

/**
 * Convert plain @username segments in content to @[Name](userId) using the provided users.
 * Matches by display name (full_name); case-insensitive match.
 * @param content - Text that may contain plain @Username tokens
 * @param users - List of users with id and full_name for resolution
 * @returns Content with @username replaced by @[Name](userId)
 */
export function formatMentions(content: string, users: MentionUser[]): string {
  if (!content || typeof content !== 'string') return content
  if (!Array.isArray(users) || users.length === 0) return content
  const nameToUser = new Map<string, MentionUser>()
  for (const u of users) {
    const name = (u.full_name ?? '').trim() || u.id
    nameToUser.set(name.toLowerCase(), u)
    if (u.full_name?.trim()) nameToUser.set(u.full_name.trim(), u)
  }
  return content.replace(AT_NAME_REGEX, (match, namePart) => {
    const key = namePart.trim()
    if (!key) return match
    const byExact = nameToUser.get(key)
    if (byExact) return formatMention(byExact.full_name ?? byExact.id, byExact.id)
    const byLower = nameToUser.get(key.toLowerCase())
    if (byLower) return formatMention(byLower.full_name ?? byLower.id, byLower.id)
    return match
  })
}

/**
 * Render raw content as React nodes with styled spans for mentions.
 * Accepts raw content and internally parses/segments; contract: renderMentions(content: string): React.ReactNode.
 */
export function renderMentions(content: string): React.ReactNode {
  const segments = parseMentionsToSegments(content ?? '')
  return renderMentionsFromSegments(segments)
}

/**
 * Render parsed segments as React nodes with styled spans for mentions.
 * Segment-based helper; use renderMentions(content) for raw content.
 * Mention segments are wrapped in a span with data-mention and data-user-id for styling.
 */
export function renderMentionsFromSegments(segments: MentionSpan[]): React.ReactNode {
  if (!segments?.length) return null
  return segments.map((s, i) => {
    if (s.type === 'mention') {
      const display = s.displayName ?? s.userId ?? ''
      return React.createElement(
        'span',
        {
          key: `m-${i}-${s.userId ?? ''}`,
          'data-mention': true,
          'data-user-id': s.userId ?? '',
          className: 'mention',
        },
        `@${display}`
      )
    }
    return React.createElement(React.Fragment, { key: `t-${i}` }, s.text ?? '')
  })
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
