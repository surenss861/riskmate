'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { commentsApi } from '@/lib/api'
import type { CommentWithAuthor } from '@/lib/api'
import { typography, emptyStateStyles, buttonStyles } from '@/lib/styles/design-system'
import clsx from 'clsx'
import { AtSign } from 'lucide-react'
import { renderMentions } from '@/lib/utils/mentionParser'
import { formatDistanceToNow } from 'date-fns'

const PAGE_SIZE = 20

export type MentionItem = CommentWithAuthor & { job_id?: string | null }

export interface MentionsInboxProps {
  /** Called after initial load and loadMore with latest count so the badge can stay in sync / clear after reading */
  onMentionsCountChange?: (count: number) => void
}

export function MentionsInbox({ onMentionsCountChange }: MentionsInboxProps) {
  const router = useRouter()
  const [items, setItems] = useState<MentionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (offsetVal: number, append: boolean) => {
    const isLoadMore = offsetVal > 0
    if (isLoadMore) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await commentsApi.listMentionsMe({
        limit: PAGE_SIZE,
        offset: offsetVal,
      })
      const data = (res.data ?? []) as MentionItem[]
      setHasMore(res.has_more === true)
      setOffset(offsetVal + data.length)
      if (append) {
        setItems((prev) => [...prev, ...data])
      } else {
        setItems(data)
      }
      if (res.count != null) onMentionsCountChange?.(res.count)
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Failed to load mentions'
      setError(msg)
      if (!append) setItems([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [onMentionsCountChange])

  useEffect(() => {
    load(0, false)
  }, [load])

  const loadMore = () => {
    if (!loadingMore && hasMore) load(offset, true)
  }

  const getEntityLabel = (entityType: string) => {
    switch (entityType) {
      case 'hazard': return 'Mention on hazard'
      case 'control': return 'Mention on control'
      case 'photo': return 'Mention on photo'
      case 'job': return 'View job'
      default: return 'View'
    }
  }

  const handleMentionClick = (c: MentionItem) => {
    const jobId = c.job_id ?? (c.entity_type === 'job' ? c.entity_id : null)
    if (jobId) {
      router.push(`/operations/jobs/${jobId}`)
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse h-16 rounded-lg bg-white/5" />
        <div className="animate-pulse h-16 rounded-lg bg-white/5" />
        <div className="animate-pulse h-16 rounded-lg bg-white/5" />
      </div>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className={clsx(emptyStateStyles.container, 'py-8')}>
        <p className={emptyStateStyles.title}>Couldn’t load mentions</p>
        <p className={emptyStateStyles.description}>{error}</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={clsx(emptyStateStyles.container, 'py-8')}>
        <AtSign className={emptyStateStyles.icon} />
        <p className={emptyStateStyles.title}>No mentions yet</p>
        <p className={emptyStateStyles.description}>
          When someone @mentions you in a comment, it will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((c) => {
          // API returns job_id for job and for hazard/control/photo (resolved from parent entity)
          const jobId = c.job_id ?? (c.entity_type === 'job' ? c.entity_id : null)
          const canNavigate = Boolean(jobId)
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => handleMentionClick(c)}
                disabled={!canNavigate}
                className={clsx(
                  'w-full text-left p-4 rounded-lg border transition-colors',
                  canNavigate
                    ? 'border-white/10 bg-white/[0.03] hover:bg-white/5 cursor-pointer'
                    : 'border-white/5 bg-white/[0.02] cursor-not-allowed opacity-80'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={clsx(typography.body, 'font-medium text-white/90')}>
                    {c.author?.full_name?.trim() || c.author?.email || 'Unknown'}
                  </span>
                  <span className="text-xs text-white/50">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <div className={clsx(typography.body, 'text-white/70 line-clamp-2')}>
                  {renderMentions(c.content)}
                </div>
                <div className="mt-2 text-xs text-white/50">
                  {canNavigate ? (
                    <span>{getEntityLabel(c.entity_type)} →</span>
                  ) : (
                    <span>{getEntityLabel(c.entity_type)} — open from job to view</span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={loadMore}
          className={clsx(buttonStyles.secondary, 'w-full')}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
