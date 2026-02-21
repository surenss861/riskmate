'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { jobsApi, commentsApi, teamApi } from '@/lib/api'
import type { CommentWithAuthor } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { renderMentions, extractMentionQuery, formatMention } from '@/lib/utils/mentionParser'
import { typography, spacing, buttonStyles, emptyStateStyles } from '@/lib/styles/design-system'
import { MessageSquare, Send, CheckCircle2, Circle, Reply, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'

interface MentionUser {
  id: string
  full_name: string | null
  email: string
}

export interface JobCommentsPanelProps {
  jobId: string
  onError?: (message: string) => void
}

export function JobCommentsPanel({ jobId, onError }: JobCommentsPanelProps) {
  const [comments, setComments] = useState<CommentWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [replyForId, setReplyForId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [repliesByParent, setRepliesByParent] = useState<Record<string, CommentWithAuthor[]>>({})
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({})
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('member')
  const [members, setMembers] = useState<MentionUser[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionCursorPos, setMentionCursorPos] = useState(0)
  const [mentionAnchorRef, setMentionAnchorRef] = useState<HTMLTextAreaElement | null>(null)
  const newTextareaRef = useRef<HTMLTextAreaElement>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  const loadComments = useCallback(async () => {
    if (!jobId) return
    setLoading(true)
    try {
      const res = await jobsApi.getComments(jobId, { limit: 50, include_replies: false })
      setComments(res.data ?? [])
    } catch (e: any) {
      onError?.(e?.message ?? 'Failed to load comments')
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [jobId, onError])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (user) setCurrentUserId(user.id)
      try {
        const team = await teamApi.get()
        if (cancelled) return
        setMembers(
          (team.members ?? []).map((m: any) => ({
            id: m.id,
            full_name: m.full_name ?? null,
            email: m.email ?? '',
          }))
        )
        setCurrentUserRole(team.current_user_role ?? 'member')
      } catch {
        // ignore
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const loadReplies = useCallback(async (parentId: string) => {
    if (repliesByParent[parentId]?.length !== undefined) return
    setLoadingReplies((prev) => ({ ...prev, [parentId]: true }))
    try {
      const res = await commentsApi.listReplies(parentId, { limit: 50 })
      setRepliesByParent((prev) => ({ ...prev, [parentId]: res.data ?? [] }))
    } catch {
      setRepliesByParent((prev) => ({ ...prev, [parentId]: [] }))
    } finally {
      setLoadingReplies((prev) => ({ ...prev, [parentId]: false }))
    }
  }, [repliesByParent])

  const handleSubmitNew = async () => {
    const content = newContent.trim()
    if (!content || submitting) return
    setSubmitting(true)
    try {
      await jobsApi.createComment(jobId, { content })
      setNewContent('')
      await loadComments()
    } catch (e: any) {
      onError?.(e?.message ?? 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    const content = replyContent.trim()
    if (!content || submitting) return
    setSubmitting(true)
    try {
      await commentsApi.createReply(parentId, { content })
      setReplyContent('')
      setReplyForId(null)
      await loadReplies(parentId)
      await loadComments() // refresh reply_count
    } catch (e: any) {
      onError?.(e?.message ?? 'Failed to post reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async (commentId: string, resolve: boolean) => {
    try {
      if (resolve) await commentsApi.resolve(commentId)
      else await commentsApi.unresolve(commentId)
      await loadComments()
    } catch (e: any) {
      onError?.(e?.message ?? 'Failed to update comment')
    }
  }

  const handleUpdate = async (commentId: string) => {
    const content = editContent.trim()
    if (!content) return
    try {
      await commentsApi.update(commentId, content)
      setEditId(null)
      setEditContent('')
      await loadComments()
    } catch (e: any) {
      onError?.(e?.message ?? 'Failed to update comment')
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return
    try {
      await commentsApi.delete(commentId)
      await loadComments()
      setRepliesByParent((prev) => {
        const next = { ...prev }
        delete next[commentId]
        return next
      })
    } catch (e: any) {
      onError?.(e?.message ?? 'Failed to delete comment')
    }
  }

  const canResolve = (c: CommentWithAuthor) =>
    currentUserId && (c.author_id === currentUserId || currentUserRole === 'owner' || currentUserRole === 'admin')
  const canEditOrDelete = (c: CommentWithAuthor) =>
    currentUserId && (c.author_id === currentUserId || currentUserRole === 'owner' || currentUserRole === 'admin')

  // Mention autocomplete: track @ and cursor in new comment textarea
  const handleNewContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setNewContent(value)
    const ta = e.target
    const pos = ta.selectionStart ?? 0
    setMentionCursorPos(pos)
    setMentionQuery(extractMentionQuery(value, pos))
    setMentionAnchorRef(ta)
  }
  const handleNewContentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    const pos = ta.selectionStart ?? 0
    setMentionCursorPos(pos)
    const query = extractMentionQuery(ta.value, pos)
    setMentionQuery(query)
    setMentionAnchorRef(ta)
  }
  const mentionCandidates = mentionQuery
    ? members.filter(
        (m) =>
          (m.full_name?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            m.email.toLowerCase().includes(mentionQuery.toLowerCase())) &&
          m.id !== currentUserId
      ).slice(0, 5)
    : []

  const insertMention = (user: MentionUser, target: 'new' | 'reply', parentId?: string) => {
    const token = formatMention(user.full_name ?? user.email, user.id)
    if (target === 'new' && newTextareaRef.current) {
      const ta = newTextareaRef.current
      const start = ta.value.slice(0, mentionCursorPos).lastIndexOf('@')
      const before = start >= 0 ? ta.value.slice(0, start) : ta.value
      const after = ta.value.slice(mentionCursorPos)
      const next = before + token + ' ' + after
      setNewContent(next)
      setMentionQuery(null)
      setTimeout(() => ta.focus(), 0)
    } else if (target === 'reply' && parentId && replyTextareaRef.current) {
      const ta = replyTextareaRef.current
      const pos = ta.selectionStart ?? 0
      const start = ta.value.slice(0, pos).lastIndexOf('@')
      const before = start >= 0 ? ta.value.slice(0, start) : ta.value
      const after = ta.value.slice(pos)
      setReplyContent(before + token + ' ' + after)
      setMentionQuery(null)
      setTimeout(() => ta.focus(), 0)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-24 rounded-lg bg-white/5" />
        <div className="animate-pulse h-32 rounded-lg bg-white/5" />
        <div className="animate-pulse h-20 rounded-lg bg-white/5" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <label className={clsx(typography.label, 'block mb-2')}>Add a comment</label>
        <div className="relative">
          <textarea
            ref={newTextareaRef}
            value={newContent}
            onChange={handleNewContentChange}
            onKeyDown={handleNewContentKeyDown}
            onSelect={() => {
              const ta = newTextareaRef.current
              if (ta) setMentionCursorPos(ta.selectionStart ?? 0)
            }}
            placeholder="Write a comment… Use @ to mention a teammate."
            rows={3}
            className={clsx(
              'w-full px-4 py-3 rounded-lg border border-white/10 bg-white/5 text-white/90 placeholder:text-white/40',
              'focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 resize-y min-h-[80px]'
            )}
          />
          {mentionCandidates.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-white/10 bg-[#1a1a1a] py-1 shadow-lg"
              role="listbox"
            >
              {mentionCandidates.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  className="w-full px-4 py-2 text-left text-sm text-white/90 hover:bg-white/10 flex items-center gap-2"
                  onClick={() => insertMention(m, 'new')}
                >
                  <span className="font-medium">{m.full_name || m.email}</span>
                  {m.full_name && <span className="text-white/50 text-xs">{m.email}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          disabled={!newContent.trim() || submitting}
          onClick={handleSubmitNew}
          className={clsx(buttonStyles.primary, 'mt-2 inline-flex items-center gap-2')}
        >
          <Send className="w-4 h-4" />
          Post
        </button>
      </div>

      <div>
        <h3 className={clsx(typography.h3, 'mb-4')}>Comments</h3>
        {comments.length === 0 ? (
          <div className={clsx(emptyStateStyles.container, 'py-12')}>
            <MessageSquare className={emptyStateStyles.icon} />
            <p className={emptyStateStyles.title}>No comments yet</p>
            <p className={emptyStateStyles.description}>Be the first to add a comment or mention a teammate.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white/90">
                        {c.author?.full_name || c.author?.email || 'Unknown'}
                      </span>
                      <span className="text-xs text-white/50">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                      {c.edited_at && (
                        <span className="text-xs text-white/40">(edited)</span>
                      )}
                      {c.is_resolved && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                        </span>
                      )}
                    </div>
                    {editId === c.id ? (
                      <div className="mt-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={2}
                          className={clsx(
                            'w-full px-3 py-2 rounded border border-white/10 bg-black/30 text-white/90 text-sm'
                          )}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            type="button"
                            className={buttonStyles.primary}
                            onClick={() => handleUpdate(c.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={buttonStyles.secondary}
                            onClick={() => { setEditId(null); setEditContent(''); }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-white/80 break-words [&_.mention]:text-[#F97316] [&_.mention]:font-medium">
                        {renderMentions(c.content)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canResolve(c) && (
                      <button
                        type="button"
                        onClick={() => handleResolve(c.id, !c.is_resolved)}
                        className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
                        title={c.is_resolved ? 'Unresolve' : 'Resolve'}
                      >
                        {c.is_resolved ? (
                          <Circle className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {canEditOrDelete(c) && editId !== c.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setEditId(c.id); setEditContent(c.content); }}
                          className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded text-white/60 hover:text-red-400 hover:bg-white/10"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyForId(replyForId === c.id ? null : c.id)
                      if (replyForId !== c.id) loadReplies(c.id)
                    }}
                    className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
                  >
                    {replyForId === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Reply className="w-3.5 h-3.5" />
                    Reply {(c.reply_count ?? 0) > 0 && `(${c.reply_count})`}
                  </button>
                </div>
                {replyForId === c.id && (
                  <div className="mt-4 pl-4 border-l-2 border-white/10 space-y-3">
                    {loadingReplies[c.id] ? (
                      <div className="animate-pulse h-10 rounded bg-white/5" />
                    ) : (
                      (repliesByParent[c.id] ?? []).map((r) => (
                        <div key={r.id} className="flex gap-2">
                          <span className="font-medium text-white/70 text-sm shrink-0">
                            {r.author?.full_name || r.author?.email || 'Unknown'}
                          </span>
                          <span className="text-xs text-white/50 shrink-0">
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </span>
                          <span className="text-sm text-white/80 break-words [&_.mention]:text-[#F97316]">
                            {renderMentions(r.content)}
                          </span>
                        </div>
                      ))
                    )}
                    <div className="flex gap-2">
                      <textarea
                        ref={replyTextareaRef}
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply…"
                        rows={2}
                        className={clsx(
                          'flex-1 min-w-0 px-3 py-2 rounded border border-white/10 bg-black/30 text-white/90 text-sm placeholder:text-white/40'
                        )}
                      />
                      <button
                        type="button"
                        disabled={!replyContent.trim() || submitting}
                        onClick={() => handleSubmitReply(c.id)}
                        className={buttonStyles.primary}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
