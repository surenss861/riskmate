'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, isAfter } from 'date-fns'
import { jobsApi } from '@/lib/api'
import { subscribeToJobActivity } from '@/lib/realtime/eventSubscription'
import { getEventMapping } from '@/lib/audit/eventMapper'
import { toast } from '@/lib/utils/toast'
import { typography, spacing, tabStyles, emptyStateStyles, badgeStyles, cardStyles } from '@/lib/styles/design-system'
import { SkeletonLoader } from '@/components/dashboard/SkeletonLoader'
import { EventChip } from '@/components/shared'
import { Clock, User, FileText, Activity, Users, Calendar, ArrowUpToLine } from 'lucide-react'

export interface AuditEvent {
  id: string
  event_name?: string
  event_type?: string
  created_at: string
  category?: string
  severity?: 'critical' | 'material' | 'info'
  outcome?: string
  actor_name?: string
  actor_email?: string
  actor_role?: string
  actor_id?: string
  target_type?: string
  target_id?: string
  metadata?: Record<string, unknown>
  summary?: string
}

export interface JobActivityFeedProps {
  jobId: string
  initialEvents?: AuditEvent[]
  enableRealtime?: boolean
  showFilters?: boolean
  maxHeight?: string
}

const PAGE_SIZE = 20
const FILTER_ALL = 'all'
const FILTER_STATUS = 'status'
const FILTER_DOCUMENTS = 'documents'
const FILTER_TEAM = 'team'
const DEBOUNCE_MS = 1000
const HIGHLIGHT_DURATION_MS = 2000
const SCROLL_THRESHOLD_PX = 80
type FilterType = typeof FILTER_ALL | typeof FILTER_STATUS | typeof FILTER_DOCUMENTS | typeof FILTER_TEAM
type ActiveFilterState = { filter: FilterType; startDate: string | null; endDate: string | null }

const STATUS_EVENT_TYPES = ['status_changed', 'job.updated', 'job.status_changed', 'job.created']
const DOCUMENT_EVENT_TYPES = ['document.uploaded', 'photo.uploaded', 'evidence.approved', 'evidence.rejected', 'proof_pack.generated', 'permit_pack.generated']
const TEAM_EVENT_TYPES = ['worker.assigned', 'worker.unassigned', 'assignment.created', 'assignment.removed', 'signoff.created']

function filterEventsByType(events: AuditEvent[], filter: FilterType): AuditEvent[] {
  if (filter === FILTER_ALL) return events
  const eventType = (e: AuditEvent) => (e.event_type || e.event_name || '').toLowerCase()
  if (filter === FILTER_STATUS) {
    return events.filter((e) => STATUS_EVENT_TYPES.some((t) => eventType(e).includes(t)))
  }
  if (filter === FILTER_DOCUMENTS) {
    return events.filter((e) => DOCUMENT_EVENT_TYPES.some((t) => eventType(e).includes(t.split('.')[0])))
  }
  if (filter === FILTER_TEAM) {
    return events.filter((e) => TEAM_EVENT_TYPES.some((t) => eventType(e).includes(t.split('.')[0])))
  }
  return events
}

function eventMatchesDateRange(event: AuditEvent, startDate: string | null, endDate: string | null): boolean {
  if (!startDate && !endDate) return true
  const eventDate = event.created_at.slice(0, 10)
  if (startDate && eventDate < startDate) return false
  if (endDate && eventDate > endDate) return false
  return true
}

function formatEventTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function getBadgeVariant(severity?: string, outcome?: string): 'Success' | 'Info' | 'Warning' | 'Error' {
  if (outcome === 'blocked' || outcome === 'failure') return 'Error'
  if (severity === 'critical') return 'Error'
  if (severity === 'material') return 'Warning'
  return 'Info'
}

export function JobActivityFeed({
  jobId,
  initialEvents,
  enableRealtime = true,
  showFilters = true,
  maxHeight = '70vh',
}: JobActivityFeedProps) {
  const [events, setEvents] = useState<AuditEvent[]>(initialEvents ?? [])
  const [loading, setLoading] = useState(!initialEvents?.length)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<FilterType>(FILTER_ALL)
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const filterRef = useRef<ActiveFilterState>({ filter, startDate, endDate })
  filterRef.current = { filter, startDate, endDate }
  const [subscribeContext, setSubscribeContext] = useState<{ channelId: string; organizationId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [showScrollToTop, setShowScrollToTop] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const pendingEventsRef = useRef<AuditEvent[]>([])
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastToastAtRef = useRef<number>(0)
  const prevRealtimeStatusRef = useRef<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [subscriptionRetryKey, setSubscriptionRetryKey] = useState(0)
  const eventsRef = useRef<AuditEvent[]>([])
  const actorCacheRef = useRef<Map<string, { actor_name: string; actor_email: string; actor_role: string }>>(new Map())
  const actorFetchPromiseRef = useRef<Map<string, Promise<{ actor_name: string; actor_email: string; actor_role: string } | null>>>(new Map())
  const today = format(new Date(), 'yyyy-MM-dd')
  const dateValidationError = startDate && endDate && isAfter(new Date(startDate), new Date(endDate)) ? 'Start date cannot be after end date.' : null

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  const resolveActor = useCallback(async (actorId: string): Promise<{ actor_name: string; actor_email: string; actor_role: string } | null> => {
    if (!actorId) return null
    const existing = eventsRef.current.find((e) => e.actor_id === actorId && (e.actor_name != null || e.actor_email != null))
    if (existing) {
      const resolved = {
        actor_name: existing.actor_name ?? 'Unknown',
        actor_email: existing.actor_email ?? '',
        actor_role: existing.actor_role ?? 'member',
      }
      actorCacheRef.current.set(actorId, resolved)
      return resolved
    }
    const cached = actorCacheRef.current.get(actorId)
    if (cached) return cached
    let promise = actorFetchPromiseRef.current.get(actorId)
    if (!promise) {
      promise = jobsApi.getActor(actorId).then((actor) => {
        if (actor) actorCacheRef.current.set(actorId, actor)
        actorFetchPromiseRef.current.delete(actorId)
        return actor
      })
      actorFetchPromiseRef.current.set(actorId, promise)
    }
    return promise
  }, [])

  const getEventTypesForFilter = useCallback((f: FilterType): string[] | undefined => {
    if (f === FILTER_ALL) return undefined
    if (f === FILTER_STATUS) return STATUS_EVENT_TYPES
    if (f === FILTER_DOCUMENTS) return DOCUMENT_EVENT_TYPES
    if (f === FILTER_TEAM) return TEAM_EVENT_TYPES
    return undefined
  }, [])

  const fetchPage = useCallback(
    async (off: number, append: boolean, filterParam?: FilterType) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      const eventTypes = getEventTypesForFilter(filterParam ?? filter)
      try {
        const res = await jobsApi.getJobActivity(jobId, {
          limit: PAGE_SIZE,
          offset: off,
          ...(eventTypes?.length ? { event_types: eventTypes } : {}),
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        })
        const data = res.data as { events: AuditEvent[]; total: number; has_more: boolean }
        const list = data?.events ?? []
        const tot = data?.total ?? 0
        const more = data?.has_more ?? false
        if (append) {
          setEvents((prev) => (off === 0 ? list : [...prev, ...list]))
        } else {
          setEvents(list)
        }
        setTotal(tot)
        setHasMore(more)
        setOffset(off + list.length)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load activity'
        setError(message)
        if (!append) setEvents([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [jobId, filter, getEventTypesForFilter, startDate, endDate]
  )

  useEffect(() => {
    if (!jobId) return
    if (dateValidationError) return
    fetchPage(0, false, filter)
  }, [jobId, filter, startDate, endDate, dateValidationError, fetchPage])

  useEffect(() => {
    if (!enableRealtime || !jobId) return
    setRealtimeStatus('connecting')
    let cancelled = false
    jobsApi
      .subscribeJobActivity(jobId)
      .then((ctx) => {
        if (!cancelled && ctx) setSubscribeContext(ctx)
        else if (!cancelled) setRealtimeStatus('idle')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        cancelled = true
        setSubscribeContext(null)
        setRealtimeStatus('error')
        prevRealtimeStatusRef.current = 'error'
        toast.error('Live updates disconnected. Reconnecting…')
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          setSubscriptionRetryKey((k) => k + 1)
        }, 3000)
        console.warn('subscribeJobActivity failed:', err)
      })
    return () => {
      cancelled = true
      setSubscribeContext(null)
      setRealtimeStatus('idle')
    }
  }, [enableRealtime, jobId, subscriptionRetryKey])

  const flushPendingEvents = useCallback(() => {
    const pending = pendingEventsRef.current
    if (pending.length === 0) return
    pendingEventsRef.current = []
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    const ids = new Set(pending.map((e) => e.id))
    setNewEventIds((prev) => new Set([...prev, ...ids]))
    setTimeout(() => {
      setNewEventIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
    }, HIGHLIGHT_DURATION_MS)
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id))
      const toPrepend = pending.filter((e) => !existingIds.has(e.id))
      if (toPrepend.length === 0) return prev
      setTotal((t) => t + toPrepend.length)
      setOffset((o) => o + toPrepend.length)
      const el = scrollContainerRef.current
      const isAtTop = !el || el.scrollTop <= SCROLL_THRESHOLD_PX
      const now = Date.now()
      if (!isAtTop && now - lastToastAtRef.current >= DEBOUNCE_MS) {
        lastToastAtRef.current = now
        toast.success(toPrepend.length === 1 ? 'New activity' : `${toPrepend.length} new activities`)
      }
      return [...toPrepend, ...prev]
    })
  }, [])

  useEffect(() => {
    if (!subscribeContext) return
    const { channelId, organizationId } = subscribeContext
    const unsubscribe = subscribeToJobActivity(jobId, organizationId, {
      channelIdOverride: channelId,
      onStatusChange: (status) => {
        const wasConnected = prevRealtimeStatusRef.current === 'connected'
        const nextStatus: 'idle' | 'connecting' | 'connected' | 'error' =
          status === 'SUBSCRIBED'
            ? 'connected'
            : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'
              ? 'error'
              : 'idle'
        setRealtimeStatus(nextStatus)
        prevRealtimeStatusRef.current = nextStatus

        // Always auto-retry on error status so initial connection failures recover
        if (nextStatus === 'error') {
          if (wasConnected) toast.error('Live updates disconnected. Reconnecting…')
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null
            setSubscriptionRetryKey((k) => k + 1)
          }, 3000)
        }
      },
      onEvent: async (payload) => {
        const row = payload.new as Record<string, unknown>
        const actorId = row.actor_id as string | undefined
        let actor_name = row.actor_name as string | undefined
        let actor_email = row.actor_email as string | undefined
        let actor_role = row.actor_role as string | undefined
        if (actorId && (actor_name == null || actor_email == null || actor_role == null)) {
          const resolved = await resolveActor(actorId)
          if (resolved) {
            actor_name = actor_name ?? resolved.actor_name
            actor_email = actor_email ?? resolved.actor_email
            actor_role = actor_role ?? resolved.actor_role
          }
        }
        const newEvent: AuditEvent = {
          id: row.id as string,
          event_name: row.event_name as string,
          event_type: row.event_name as string,
          created_at: row.created_at as string,
          category: row.category as string,
          severity: row.severity as AuditEvent['severity'],
          actor_name,
          actor_email,
          actor_role,
          actor_id: actorId,
          target_type: row.target_type as string,
          target_id: row.target_id as string,
          metadata: row.metadata as Record<string, unknown>,
        }
        pendingEventsRef.current.push(newEvent)
        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(flushPendingEvents, DEBOUNCE_MS)
        }
      },
    })
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      pendingEventsRef.current = []
      unsubscribe()
    }
  }, [jobId, subscribeContext, flushPendingEvents, subscriptionRetryKey])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    setShowScrollToTop(el.scrollTop > SCROLL_THRESHOLD_PX)
  }, [])

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const clearDates = useCallback(() => {
    setStartDate(null)
    setEndDate(null)
  }, [])

  const dateFilterActive = Boolean(startDate || endDate)
  const dateRangeLabel = startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Until ${endDate}` : 'Date Range'
  const filteredEvents = filterEventsByType(events, filter).filter((e) => eventMatchesDateRange(e, startDate, endDate))
  const showLoadMore = hasMore && !loading && !loadingMore

  if (loading && events.length === 0) {
    return (
      <div className="space-y-4" style={{ maxHeight }}>
        <div className={cardStyles.base + ' ' + cardStyles.padding.md}>
          <SkeletonLoader variant="text" lines={2} className="mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonLoader key={i} variant="card" height="72px" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: FILTER_ALL, label: 'All Events', icon: Activity },
                { key: FILTER_STATUS, label: 'Status Changes', icon: Clock },
                { key: FILTER_DOCUMENTS, label: 'Documents', icon: FileText },
                { key: FILTER_TEAM, label: 'Team Actions', icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key as FilterType)}
                  className={
                    filter === key
                      ? `${tabStyles.item} ${tabStyles.active} flex items-center gap-2 rounded-lg border border-[#F97316]/30 bg-[#F97316]/10 px-3 py-2 text-sm font-medium text-[#F97316]`
                      : `${tabStyles.item} ${tabStyles.inactive} flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowDateFilter((prev) => !prev)}
                className={
                  showDateFilter || dateFilterActive
                    ? `${tabStyles.item} ${tabStyles.active} flex items-center gap-2 rounded-lg border border-[#F97316]/30 bg-[#F97316]/10 px-3 py-2 text-sm font-medium text-[#F97316]`
                    : `${tabStyles.item} ${tabStyles.inactive} flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white`
                }
                aria-expanded={showDateFilter}
              >
                <Calendar className="h-4 w-4" />
                {dateRangeLabel}
              </button>
              {dateFilterActive && (
                <span className={`${badgeStyles.base} border-[#F97316]/30 bg-[#F97316]/10 text-[#F97316]`}>Filtered by date</span>
              )}
            </div>
            {enableRealtime && realtimeStatus !== 'idle' && (
              <span
                className="flex items-center gap-2 text-xs text-white/60"
                title={realtimeStatus === 'connected' ? 'Live updates enabled' : realtimeStatus === 'error' ? 'Connection lost' : 'Connecting...'}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    realtimeStatus === 'connected'
                      ? 'bg-green-500 animate-pulse'
                      : realtimeStatus === 'error'
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                  }`}
                />
                {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'error' ? 'Disconnected' : 'Connecting'}
              </span>
            )}
          </div>
          {showDateFilter && (
            <div className={`${cardStyles.base} ${cardStyles.padding.sm} space-y-3`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1 min-w-[160px] space-y-1">
                  <span className={`${typography.label} text-white/70`}>Start date</span>
                  <input
                    type="date"
                    max={endDate || today}
                    value={startDate ?? ''}
                    onChange={(e) => setStartDate(e.target.value || null)}
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#F97316]/50"
                  />
                </label>
                <label className="flex-1 min-w-[160px] space-y-1">
                  <span className={`${typography.label} text-white/70`}>End date</span>
                  <input
                    type="date"
                    min={startDate || undefined}
                    max={today}
                    value={endDate ?? ''}
                    onChange={(e) => setEndDate(e.target.value || null)}
                    className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-[#F97316]/50"
                  />
                </label>
                <button
                  type="button"
                  onClick={clearDates}
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10"
                >
                  Clear dates
                </button>
              </div>
              {dateValidationError && (
                <p className="text-sm text-red-400">{dateValidationError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {filteredEvents.length === 0 && !loading && (
        <div className={`${emptyStateStyles.container} py-12`}>
          <Calendar className="mx-auto mb-3 h-10 w-10 text-white/40" />
          <p className={emptyStateStyles.title}>No activity yet</p>
          <p className={emptyStateStyles.description}>
            {dateFilterActive
              ? 'No events match this date range. Try expanding or clearing the dates.'
              : filter !== FILTER_ALL
              ? 'No events match this filter. Try "All Events".'
              : 'Updates to this job will appear here—status changes, documents, and team actions.'}
          </p>
        </div>
      )}

      {filteredEvents.length > 0 && (
        <div className="relative" style={{ maxHeight }}>
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto pr-2 -mr-2"
            style={{ maxHeight: 'calc(70vh - 180px)', minHeight: 120 }}
          >
            {/* Timeline vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10" aria-hidden />
            <ul className="space-y-0">
              {filteredEvents.map((event) => {
                const mapping = getEventMapping(event.event_type || event.event_name || '')
                const badgeVariant = getBadgeVariant(event.severity || mapping.severity, event.outcome || mapping.outcome)
                const isNew = newEventIds.has(event.id)
                return (
                  <motion.li
                    key={event.id}
                    initial={isNew ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="relative flex gap-4 pb-6 last:pb-0 pl-1"
                  >
                    <div className="absolute left-0 top-5 z-10 h-3 w-3 flex-shrink-0 rounded-full bg-[#F97316] -translate-x-1/2" aria-hidden />
                    <div
                      className={`flex-1 min-w-0 pl-6 ${cardStyles.base} ${cardStyles.padding.sm} transition-all duration-300 ${
                        isNew ? 'ring-2 ring-[#F97316]/60 ring-offset-2 ring-offset-[#0A0A0A]' : ''
                      }`}
                    >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <EventChip
                            eventType={event.event_type || event.event_name || 'unknown'}
                            severity={event.severity || mapping.severity}
                            outcome={(event.outcome || mapping.outcome) as 'blocked' | 'allowed' | 'success' | 'failure' | undefined}
                            showOutcome={false}
                          />
                          {badgeVariant === 'Error' && (
                            <span className={`${badgeStyles.base} bg-red-500/20 text-red-400 border-red-500/30`}>Error</span>
                          )}
                          {badgeVariant === 'Warning' && (
                            <span className={`${badgeStyles.base} bg-amber-500/20 text-amber-400 border-amber-500/30`}>Warning</span>
                          )}
                          {badgeVariant === 'Info' && (
                            <span className={`${badgeStyles.base} bg-blue-500/20 text-blue-400 border-blue-500/30`}>Info</span>
                          )}
                        </div>
                        <p className="text-sm text-white/90">
                          {event.summary || mapping.description || mapping.title || event.event_type || event.event_name || 'Event'}
                        </p>
                        <div className={`mt-2 flex flex-wrap items-center gap-3 ${spacing.gap.tight} text-xs text-white/50`}>
                          {event.actor_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {event.actor_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatEventTime(event.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ul>
          </div>
          <AnimatePresence>
            {showScrollToTop && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                type="button"
                onClick={scrollToTop}
                className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-white/20 bg-[#0A0A0A]/90 px-3 py-2 text-sm font-medium text-white/90 shadow-lg backdrop-blur-sm hover:bg-white/10"
                aria-label="Scroll to top"
              >
                <ArrowUpToLine className="h-4 w-4" />
                New activity
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {showLoadMore && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => fetchPage(offset, true, filter)}
            disabled={loadingMore}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent mr-2 align-middle" />
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
