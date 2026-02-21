'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { jobsApi, commentsApi, teamApi } from '@/lib/api'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { typography, emptyStateStyles, buttonStyles } from '@/lib/styles/design-system'
import clsx from 'clsx'
import { MessageSquare } from 'lucide-react'
import { CommentCompose, CommentThread, type CommentItem, type MentionUser } from '@/components/comments'
import { extractMentionUserIds } from '@/lib/utils/mentionParser'

const COMMENT_PAGE_SIZE = 20
const REPLY_PAGE_SIZE = 50

export interface JobCommentsPanelProps {
  jobId: string
  onError?: (message: string) => void
  onCommentCountChange?: (count: number) => void
  onUnreadCountChange?: (unreadCount: number) => void
  onNewCommentArrived?: () => void
  /** Timestamp (ms or ISO string) before which comments are considered read; used for unread badge. */
  lastViewedAt?: number | string | null
}

export function JobCommentsPanel({
  jobId,
  onError,
  onCommentCountChange,
  onUnreadCountChange,
  onNewCommentArrived,
  lastViewedAt,
}: JobCommentsPanelProps) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreComments, setHasMoreComments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [replyForId, setReplyForId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [repliesByParent, setRepliesByParent] = useState<Record<string, CommentItem[]>>({})
  type RepliesStatus = 'idle' | 'loading' | 'loaded' | 'error'
  const [repliesStatus, setRepliesStatus] = useState<Record<string, RepliesStatus>>({})
  const [hasMoreRepliesByParent, setHasMoreRepliesByParent] = useState<Record<string, boolean>>({})
  const [loadingMoreRepliesForId, setLoadingMoreRepliesForId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('member')
  const [members, setMembers] = useState<MentionUser[]>([])
  const loadingRepliesInFlightRef = useRef<Record<string, boolean>>({})
  const repliesOffsetRef = useRef<Record<string, number>>({})
  const commentsListRef = useRef<HTMLUListElement>(null)
  const previousCommentsLengthRef = useRef(0)
  const pendingNewIdRef = useRef<string | null>(null)
  const pendingReplyIdsRef = useRef<Record<string, string>>({})

  const loadComments = useCallback(
    async (offset?: number) => {
      if (!jobId) return
      const isLoadMore = offset != null && offset > 0
      if (isLoadMore) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await jobsApi.getComments(jobId, {
          limit: COMMENT_PAGE_SIZE,
          offset: offset ?? 0,
          include_replies: false,
        })
        const data = res.data ?? []
        const hasMore = res.has_more === true
        setHasMoreComments(hasMore)
        if (isLoadMore) {
          setComments((prev) => [...prev, ...data])
        } else {
          setComments(data)
        }
        // Tab badge count is set by refreshCommentBadgeCounts (includes replies)
      } catch (e: unknown) {
        const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to load comments'
        onError?.(message)
        if (!isLoadMore) setComments([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [jobId, onError]
  )

  // Tab badge: total count (including replies) and server-supplied unread count (including replies when threads collapsed).
  const refreshCommentBadgeCounts = useCallback(() => {
    if (!jobId) return
    const run = async () => {
      try {
        const [countRes, unreadRes] = await Promise.all([
          jobsApi.getCommentCount(jobId, { include_replies: true }),
          jobsApi.getCommentUnreadCount(jobId, {
            since: lastViewedAt != null
              ? (typeof lastViewedAt === 'number' ? new Date(lastViewedAt) : new Date(lastViewedAt)).toISOString()
              : new Date(0).toISOString(),
          }),
        ])
        if (countRes?.count != null) onCommentCountChange?.(countRes.count)
        if (unreadRes?.count != null) onUnreadCountChange?.(unreadRes.count)
      } catch {
        // ignore badge errors
      }
    }
    run()
  }, [jobId, lastViewedAt, onCommentCountChange, onUnreadCountChange])

  useEffect(() => {
    loadComments(0)
  }, [loadComments])

  useEffect(() => {
    refreshCommentBadgeCounts()
  }, [refreshCommentBadgeCounts])

  const loadReplies = useCallback(async (parentId: string, forceRefresh = false) => {
    const isLoadMore = !forceRefresh && (repliesOffsetRef.current[parentId] ?? 0) > 0
    if (loadingRepliesInFlightRef.current[parentId] && !forceRefresh) return
    loadingRepliesInFlightRef.current[parentId] = true
    if (isLoadMore) setLoadingMoreRepliesForId(parentId)
    else setRepliesStatus((prev) => ({ ...prev, [parentId]: 'loading' }))
    const offset = forceRefresh ? 0 : (repliesOffsetRef.current[parentId] ?? 0)
    try {
      const res = await commentsApi.listReplies(parentId, { limit: REPLY_PAGE_SIZE, offset })
      const data = res.data ?? []
      const has_more = res.has_more === true
      setHasMoreRepliesByParent((prev) => ({ ...prev, [parentId]: has_more }))
      if (forceRefresh) {
        setRepliesByParent((prev) => ({ ...prev, [parentId]: data }))
        repliesOffsetRef.current[parentId] = data.length
      } else {
        setRepliesByParent((prev) => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), ...data] }))
        repliesOffsetRef.current[parentId] = (repliesOffsetRef.current[parentId] ?? 0) + data.length
      }
      setRepliesStatus((prev) => ({ ...prev, [parentId]: 'loaded' }))
    } catch {
      setRepliesByParent((prev) => {
        const next = { ...prev }
        if (forceRefresh) delete next[parentId]
        return next
      })
      setRepliesStatus((prev) => ({ ...prev, [parentId]: 'error' }))
    } finally {
      loadingRepliesInFlightRef.current[parentId] = false
      setLoadingMoreRepliesForId(null)
    }
  }, [])

  // Unread count is supplied by server (refreshCommentBadgeCounts) so it includes replies even when threads stay collapsed.

  // Realtime: subscribe to comments for this job; refresh list and reply counts
  useEffect(() => {
    if (!jobId) return
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`job-comments-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `entity_id=eq.${jobId}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          const row = payload.new as Record<string, unknown> | undefined
          if (!row || (row.entity_type as string) !== 'job') return
          const parentId = row.parent_id as string | null | undefined
          loadComments(0)
          if (parentId) loadReplies(parentId, true)
          refreshCommentBadgeCounts()
          onNewCommentArrived?.()
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId, loadComments, loadReplies, refreshCommentBadgeCounts, onNewCommentArrived])

  // Scroll to newest comment when list grows (realtime or optimistic)
  useEffect(() => {
    const len = comments.length
    if (len > previousCommentsLengthRef.current && commentsListRef.current) {
      const last = commentsListRef.current.querySelector('li:last-of-type')
      if (last) (last as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      onNewCommentArrived?.()
    }
    previousCommentsLengthRef.current = len
  }, [comments.length, onNewCommentArrived])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (user) setCurrentUserId(user.id)
      try {
        const team = await teamApi.get()
        if (cancelled) return
        setMembers(
          (team.members ?? []).map((m: { id: string; full_name?: string | null; email?: string; role?: string }) => ({
            id: m.id,
            full_name: m.full_name ?? null,
            email: m.email ?? '',
            role: m.role ?? null,
          }))
        )
        setCurrentUserRole(team.current_user_role ?? 'member')
      } catch {
        // ignore
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmitNew = async (content: string, mentionUserIds: string[]) => {
    if (!content.trim() || submitting) return
    const pendingId = `pending-new-${Date.now()}`
    pendingNewIdRef.current = pendingId
    const optimistic: CommentItem = {
      id: pendingId,
      organization_id: '',
      entity_type: 'job',
      entity_id: jobId,
      parent_id: null,
      author_id: currentUserId ?? '',
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reply_count: 0,
      author: members.find((m) => m.id === currentUserId)
        ? {
            id: currentUserId!,
            full_name: members.find((m) => m.id === currentUserId)!.full_name,
            email: members.find((m) => m.id === currentUserId)!.email,
          }
        : undefined,
      _pending: true,
    }
    setComments((prev) => [...prev, optimistic])
    setSubmitting(true)
    try {
      await jobsApi.createComment(jobId, {
        content: content.trim(),
        mention_user_ids: mentionUserIds.length > 0 ? mentionUserIds : undefined,
      })
      await loadComments(0)
      refreshCommentBadgeCounts()
    } catch (e: unknown) {
      setComments((prev) => prev.filter((c) => c.id !== pendingId))
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to post comment'
      onError?.(message)
    } finally {
      setSubmitting(false)
      pendingNewIdRef.current = null
    }
  }

  const handleSubmitReply = async (
    parentId: string,
    content: string,
    mentionUserIds: string[]
  ) => {
    if (!content.trim() || submitting) return
    const pendingId = `pending-reply-${parentId}-${Date.now()}`
    pendingReplyIdsRef.current = { ...pendingReplyIdsRef.current, [parentId]: pendingId }
    const optimistic: CommentItem = {
      id: pendingId,
      organization_id: '',
      entity_type: 'job',
      entity_id: jobId,
      parent_id: parentId,
      author_id: currentUserId ?? '',
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: members.find((m) => m.id === currentUserId)
        ? {
            id: currentUserId!,
            full_name: members.find((m) => m.id === currentUserId)!.full_name,
            email: members.find((m) => m.id === currentUserId)!.email,
          }
        : undefined,
      _pending: true,
    }
    setRepliesByParent((prev) => ({
      ...prev,
      [parentId]: [...(prev[parentId] ?? []), optimistic],
    }))
    setReplyContent('')
    setSubmitting(true)
    try {
      await commentsApi.createReply(parentId, {
        content: content.trim(),
        mention_user_ids: mentionUserIds.length > 0 ? mentionUserIds : undefined,
      })
      await loadReplies(parentId, true)
      await loadComments(0)
      setReplyForId(null)
      refreshCommentBadgeCounts()
    } catch (e: unknown) {
      setRepliesByParent((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] ?? []).filter((r) => r.id !== pendingId),
      }))
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to post reply'
      onError?.(message)
    } finally {
      setSubmitting(false)
      const next = { ...pendingReplyIdsRef.current }
      delete next[parentId]
      pendingReplyIdsRef.current = next
    }
  }

  const handleResolve = async (commentId: string, resolve: boolean) => {
    try {
      if (resolve) await commentsApi.resolve(commentId)
      else await commentsApi.unresolve(commentId)
      await loadComments(0)
      refreshCommentBadgeCounts()
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to update comment'
      onError?.(message)
    }
  }

  const handleUpdate = async (commentId: string, content: string) => {
    if (!content.trim()) return
    const mentionUserIds = extractMentionUserIds(content.trim())
    try {
      await commentsApi.update(commentId, content.trim(), mentionUserIds.length > 0 ? mentionUserIds : undefined)
      setEditId(null)
      setEditContent('')
      await loadComments(0)
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to update comment'
      onError?.(message)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this comment?')) return
    try {
      await commentsApi.delete(commentId)
      await loadComments(0)
      setRepliesByParent((prev) => {
        const next = { ...prev }
        delete next[commentId]
        return next
      })
      refreshCommentBadgeCounts()
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to delete comment'
      onError?.(message)
    }
  }

  const canResolve = (c: CommentItem): boolean =>
    Boolean(
      !c._pending &&
        currentUserId &&
        (c.author_id === currentUserId ||
          currentUserRole === 'owner' ||
          currentUserRole === 'admin')
    )
  const canEditOrDelete = (c: CommentItem): boolean =>
    Boolean(
      !c._pending &&
        currentUserId &&
        (c.author_id === currentUserId ||
          currentUserRole === 'owner' ||
          currentUserRole === 'admin')
    )

  const openReplyFor = (parentId: string | null) => {
    setReplyForId(parentId)
    if (parentId) setReplyContent('')
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
        <CommentCompose
          members={members}
          currentUserId={currentUserId}
          onSubmit={handleSubmitNew}
          disabled={submitting}
        />
      </div>

      <div>
        <h3 className={clsx(typography.h3, 'mb-4')}>Comments</h3>
        {comments.length === 0 ? (
          <div className={clsx(emptyStateStyles.container, 'py-12')}>
            <MessageSquare className={emptyStateStyles.icon} />
            <p className={emptyStateStyles.title}>No comments yet</p>
            <p className={emptyStateStyles.description}>
              Be the first to add a comment or mention a teammate.
            </p>
          </div>
        ) : (
          <ul ref={commentsListRef} className="space-y-4">
            {comments.map((c) => (
              <CommentThread
                key={c.id}
                comment={c}
                replies={repliesByParent[c.id] ?? []}
                repliesStatus={repliesStatus[c.id] ?? 'idle'}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                replyForId={replyForId}
                setReplyForId={openReplyFor}
                editId={editId}
                editContent={editContent}
                setEditId={setEditId}
                setEditContent={setEditContent}
                members={members}
                currentUserId={currentUserId}
                canResolve={canResolve}
                canEditOrDelete={canEditOrDelete}
                onResolve={handleResolve}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onLoadReplies={(parentId) => loadReplies(parentId, true)}
                onSubmitReply={handleSubmitReply}
                submitting={submitting}
                hasMoreReplies={hasMoreRepliesByParent[c.id] === true}
                loadingMoreReplies={loadingMoreRepliesForId === c.id}
                onLoadMoreReplies={() => loadReplies(c.id, false)}
              />
            ))}
            {hasMoreComments && (
              <li className="pt-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => loadComments(comments.length)}
                  className={clsx(buttonStyles.secondary, 'w-full')}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
