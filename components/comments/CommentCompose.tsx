'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { extractMentionQuery, formatMention, extractMentionUserIds } from '@/lib/utils/mentionParser'
import { buttonStyles } from '@/lib/styles/design-system'
import clsx from 'clsx'
import type { MentionUser } from './MentionAutocomplete'
import { MentionAutocomplete } from './MentionAutocomplete'

const COMMENT_MAX_LENGTH = 2000

export interface CommentComposeProps {
  placeholder?: string
  submitLabel?: string
  cancelLabel?: string
  members: MentionUser[]
  currentUserId: string | null
  onSubmit: (content: string, mentionUserIds: string[]) => Promise<void>
  onCancel?: () => void
  disabled?: boolean
  /** When true, this compose is for a reply (e.g. different styling context). */
  isReply?: boolean
  /** Optional initial value (e.g. when editing). */
  initialValue?: string
  /** Controlled mode: when provided, content is controlled by parent. */
  value?: string
  onChange?: (value: string) => void
}

/**
 * Reusable comment/reply composer with @ mention autocomplete.
 * Handles textarea, mention query extraction, candidate list, insert, and submit.
 */
export function CommentCompose({
  placeholder = 'Write a comment… Use @ to mention a teammate. Cmd+Enter to send.',
  submitLabel = 'Post',
  cancelLabel = 'Cancel',
  members,
  currentUserId,
  onSubmit,
  onCancel,
  disabled = false,
  isReply = false,
  initialValue = '',
  value: controlledValue,
  onChange: controlledOnChange,
}: CommentComposeProps) {
  const [internalContent, setInternalContent] = useState(initialValue)
  const isControlled = controlledValue !== undefined
  const content = isControlled ? (controlledValue ?? '') : internalContent
  const setContent = isControlled ? (v: string) => { controlledOnChange?.(v) } : setInternalContent
  const [submitting, setSubmitting] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionCursorPos, setMentionCursorPos] = useState(0)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)
    const ta = e.target
    const pos = ta.selectionStart ?? 0
    setMentionCursorPos(pos)
    setMentionQuery(extractMentionQuery(value, pos))
  }

  const candidates =
    mentionQuery != null
      ? members
          .filter(
            (m) =>
              (m.full_name?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
                m.email.toLowerCase().includes(mentionQuery.toLowerCase())) &&
              m.id !== currentUserId
          )
          .slice(0, 5)
      : []

  useEffect(() => {
    setHighlightIndex(0)
  }, [candidates.length])

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setMentionQuery(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const insertMention = (user: MentionUser) => {
    const token = formatMention(user.full_name ?? user.email, user.id)
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.value.slice(0, mentionCursorPos).lastIndexOf('@')
    const before = start >= 0 ? ta.value.slice(0, start) : ta.value
    const after = ta.value.slice(mentionCursorPos)
    const next = before + token + ' ' + after
    setContent(next)
    setMentionQuery(null)
    setTimeout(() => ta.focus(), 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const pos = ta.selectionStart ?? 0
    setMentionCursorPos(pos)
    const query = extractMentionQuery(ta.value, pos)
    setMentionQuery(query)

    if (candidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, candidates.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightIndex((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const chosen = candidates[highlightIndex]
        if (chosen) {
          insertMention(chosen)
          setHighlightIndex(0)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        setHighlightIndex(0)
        return
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed || submitting || disabled) return
    const mentionUserIds = extractMentionUserIds(trimmed)
    setSubmitting(true)
    try {
      await onSubmit(trimmed, mentionUserIds)
      if (isControlled) {
        controlledOnChange?.('')
      } else {
        setInternalContent('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const showCancel = Boolean(onCancel && (content.trim() || initialValue))

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={() => {
          const ta = textareaRef.current
          if (ta) setMentionCursorPos(ta.selectionStart ?? 0)
        }}
        placeholder={placeholder}
        rows={isReply ? 2 : 3}
        maxLength={COMMENT_MAX_LENGTH}
        className={clsx(
          'w-full rounded-lg border border-white/10 bg-white/5 text-white/90 placeholder:text-white/40',
          'focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 resize-y min-h-[80px]',
          isReply ? 'px-3 py-2 text-sm min-h-0' : 'px-4 py-3'
        )}
      />
      <MentionAutocomplete
        candidates={candidates}
        highlightIndex={highlightIndex}
        onSelect={insertMention}
      />
      <div className={clsx('flex items-center gap-2 flex-wrap', isReply ? 'mt-2' : 'mt-2')}>
        <button
          type="button"
          disabled={!content.trim() || submitting || disabled}
          onClick={handleSubmit}
          className={clsx(buttonStyles.primary, 'inline-flex items-center gap-2')}
        >
          <Send className="w-4 h-4" />
          {submitLabel}
        </button>
        {showCancel && (
          <button type="button" onClick={onCancel} className={clsx(buttonStyles.secondary)}>
            {cancelLabel}
          </button>
        )}
        <span className="text-xs text-white/50">
          {content.length} / {COMMENT_MAX_LENGTH}
        </span>
      </div>
    </div>
  )
}
