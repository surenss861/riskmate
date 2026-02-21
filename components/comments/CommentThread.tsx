'use client'

import React from 'react'
import { renderMentions } from '@/lib/utils/mentionParser'
import { typography, buttonStyles, emptyStateStyles } from '@/lib/styles/design-system'
import { MessageSquare, CheckCircle2, Circle, Reply, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import type { CommentWithAuthor } from '@/lib/api'
import { CommentCompose } from './CommentCompose'
import type { MentionUser } from './MentionAutocomplete'

export type CommentItem = CommentWithAuthor & { _pending?: boolean }

export interface CommentThreadProps {
  comment: CommentItem
  replies: CommentItem[]
  repliesStatus: 'idle' | 'loading' | 'loaded' | 'error'
  replyContent: string
  setReplyContent: (value: string) => void
  replyForId: string | null
  setReplyForId: (id: string | null) => void
  editId: string | null
  editContent: string
  setEditId: (id: string | null) => void
  setEditContent: (value: string) => void
  members: MentionUser[]
  currentUserId: string | null
  canResolve: (c: CommentItem) => boolean
  canEditOrDelete: (c: CommentItem) => boolean
  onResolve: (commentId: string, resolve: boolean) => void
  onUpdate: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
  onLoadReplies: (parentId: string, forceRefresh?: boolean) => void
  onSubmitReply: (parentId: string, content: string, mentionUserIds: string[]) => Promise<void>
  submitting: boolean
}

/**
 * Single comment row with author, content, resolve/edit/delete, expandable replies,
 * and reply composer with @ mention autocomplete.
 */
export function CommentThread({
  comment,
  replies,
  repliesStatus,
  replyContent,
  setReplyContent,
  replyForId,
  setReplyForId,
  editId,
  editContent,
  setEditId,
  setEditContent,
  members,
  currentUserId,
  canResolve,
  canEditOrDelete,
  onResolve,
  onUpdate,
  onDelete,
  onLoadReplies,
  onSubmitReply,
  submitting,
}: CommentThreadProps) {
  const isReplyOpen = replyForId === comment.id
  const currentReplyContent = isReplyOpen ? replyContent : ''

  return (
    <li
      className={clsx(
        'rounded-lg border border-white/10 bg-white/5 p-4',
        comment._pending && 'opacity-80'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white/90">
              {comment.author?.full_name || comment.author?.email || 'Unknown'}
            </span>
            {comment._pending && <span className="text-xs text-white/50">Sending…</span>}
            <span className="text-xs text-white/50">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {comment.edited_at && <span className="text-xs text-white/40">(edited)</span>}
            {comment.is_resolved && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
              </span>
            )}
          </div>
          {editId === comment.id ? (
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
                  onClick={() => onUpdate(comment.id, editContent.trim())}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={buttonStyles.secondary}
                  onClick={() => {
                    setEditId(null)
                    setEditContent('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-white/80 break-words [&_.mention]:text-[#F97316] [&_.mention]:font-medium">
              {renderMentions(comment.content)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canResolve(comment) && (
            <button
              type="button"
              onClick={() => onResolve(comment.id, !comment.is_resolved)}
              className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
              title={comment.is_resolved ? 'Unresolve' : 'Resolve'}
            >
              {comment.is_resolved ? (
                <Circle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </button>
          )}
          {canEditOrDelete(comment) && editId !== comment.id && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditId(comment.id)
                  setEditContent(comment.content)
                }}
                className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10"
                title="Edit"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
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
            const opening = !isReplyOpen
            setReplyForId(isReplyOpen ? null : comment.id)
            if (opening) {
              onLoadReplies(comment.id)
            }
          }}
          className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
        >
          {isReplyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Reply className="w-3.5 h-3.5" />
          Reply {(comment.reply_count ?? 0) > 0 && `(${comment.reply_count})`}
        </button>
      </div>
      {isReplyOpen && (
        <div className="mt-4 pl-4 border-l-2 border-white/10 space-y-3">
          {repliesStatus === 'error' && (
            <div className="flex items-center gap-2 py-1">
              <span className="text-xs text-red-400">Failed to load replies.</span>
              <button
                type="button"
                onClick={() => onLoadReplies(comment.id)}
                className="text-xs text-white/80 hover:text-white underline"
              >
                Retry
              </button>
            </div>
          )}
          {repliesStatus === 'loading' && (
            <div className="animate-pulse h-10 rounded bg-white/5" />
          )}
          {repliesStatus === 'loaded' && (
            <>
              {replies.map((r) => (
                <div
                  key={r.id}
                  className={clsx('flex gap-2', (r as CommentItem)._pending && 'opacity-80')}
                >
                  <span className="font-medium text-white/70 text-sm shrink-0">
                    {r.author?.full_name || r.author?.email || 'Unknown'}
                  </span>
                  <span className="text-xs text-white/50 shrink-0">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                  {(r as CommentItem)._pending && (
                    <span className="text-xs text-white/50">Sending…</span>
                  )}
                  <span className="text-sm text-white/80 break-words [&_.mention]:text-[#F97316]">
                    {renderMentions(r.content)}
                  </span>
                </div>
              ))}
            </>
          )}
          <CommentCompose
            placeholder="Write a reply… Use @ to mention. Cmd+Enter to send."
            submitLabel="Reply"
            members={members}
            currentUserId={currentUserId}
            value={currentReplyContent}
            onChange={setReplyContent}
            onSubmit={async (content, mentionUserIds) => {
              await onSubmitReply(comment.id, content, mentionUserIds)
            }}
            disabled={submitting}
            isReply
          />
        </div>
      )}
    </li>
  )
}
