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

export function MentionsInbox() {
  const router = useRouter()
  const [items, setItems] = useState<CommentWithAuthor[]>([])
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
      const data = res.data ?? []
      setHasMore(res.has_more === true)
      setOffset(offsetVal + data.length)
      if (append) {
        setItems((prev) => [...prev, ...data])
      } else {
        setItems(data)
      }
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
  }, [])

  useEffect(() => {
    load(0, false)
  }, [load])

  const loadMore = () => {
    if (!loadingMore && hasMore) load(offset, true)
  }

  const openJob = (entityId: string) => {
    router.push(`/operations/jobs/${entityId}`)
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
        {items.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => c.entity_type === 'job' && c.entity_id && openJob(c.entity_id)}
              className="w-full text-left p-4 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className={clsx(typography.bodySmall, 'font-medium text-white/90')}>
                  {c.author?.full_name?.trim() || c.author?.email || 'Unknown'}
                </span>
                <span className="text-xs text-white/50">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </span>
              </div>
              <div className={clsx(typography.bodySmall, 'text-white/70 line-clamp-2')}>
                {renderMentions(c.content)}
              </div>
              {c.entity_type === 'job' && c.entity_id && (
                <div className="mt-2 text-xs text-white/50">View job →</div>
              )}
            </button>
          </li>
        ))}
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
