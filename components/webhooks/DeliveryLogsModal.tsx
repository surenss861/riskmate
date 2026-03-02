'use client'

import React, { useEffect, useState } from 'react'
import { Button, GlassCard } from '@/components/shared'

const PAYLOAD_TRUNCATE_LENGTH = 10000
const DELIVERIES_PAGE_SIZE = 100

function PayloadDisplay({
  payload,
  deliveryId,
  showFull,
  onToggleFull,
}: {
  payload: Record<string, unknown> | undefined
  deliveryId: string
  showFull: boolean
  onToggleFull: () => void
}) {
  const str = JSON.stringify(payload ?? {}, null, 2)
  const truncated = str.length > PAYLOAD_TRUNCATE_LENGTH && !showFull
  const display = truncated ? str.slice(0, PAYLOAD_TRUNCATE_LENGTH) : str
  return (
    <div className="mt-1">
      <pre className="p-2 rounded bg-black/30 font-mono text-xs whitespace-pre-wrap break-all">
        {display}
        {truncated && '…'}
      </pre>
      {str.length > PAYLOAD_TRUNCATE_LENGTH && (
        <button
          type="button"
          onClick={onToggleFull}
          className="mt-1 text-xs text-sky-400 hover:text-sky-300"
        >
          {showFull ? 'Show less' : `Show full payload (${(str.length - PAYLOAD_TRUNCATE_LENGTH).toLocaleString()} more chars)`}
        </button>
      )}
    </div>
  )
}

export interface DeliveryAttemptEntry {
  id: string
  attempt_number: number
  response_status: number | null
  response_body: string | null
  duration_ms: number | null
  created_at: string
}

export interface DeliveryLogEntry {
  id: string
  event_type: string
  payload?: Record<string, unknown>
  response_status: number | null
  response_body: string | null
  duration_ms: number | null
  attempt_count: number
  delivered_at: string | null
  next_retry_at: string | null
  processing_since: string | null
  created_at: string
  attempts?: DeliveryAttemptEntry[]
  /** Server-computed: true only when delivery is terminally failed and retry is allowed (excludes cancelled). */
  can_retry?: boolean
}

interface DeliveryLogsModalProps {
  open: boolean
  endpointId: string
  endpointUrl: string
  onClose: () => void
}

export function DeliveryLogsModal({
  open,
  endpointId,
  endpointUrl,
  onClose,
}: DeliveryLogsModalProps) {
  const [deliveries, setDeliveries] = useState<DeliveryLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  /** Initial load failure: hide list and show full-screen error */
  const [fetchError, setFetchError] = useState<string | null>(null)
  /** Pagination (Load more) failure: keep existing deliveries visible, show non-blocking message */
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [retryErrors, setRetryErrors] = useState<Array<{ id: string; message: string }>>([])
  const [retrySuccessMessage, setRetrySuccessMessage] = useState<string | null>(null)
  const [retriedDeliveryIds, setRetriedDeliveryIds] = useState<Set<string>>(new Set())
  const [payloadShowFull, setPayloadShowFull] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open || !endpointId) return
    setExpandedId(null)
    setRetryErrors([])
    setRetrySuccessMessage(null)
    setRetriedDeliveryIds(new Set())
    setPayloadShowFull({})
    setFetchError(null)
    setLoadMoreError(null)
    setHasMore(true)
    setLoading(true)
    fetch(`/api/webhooks/${endpointId}/deliveries?limit=${DELIVERIES_PAGE_SIZE}&offset=0`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          let msg = `Request failed (${res.status})`
          try {
            const j = await res.json()
            msg = (j as { message?: string }).message ?? (j as { error?: string }).error ?? msg
          } catch {
            try {
              const t = await res.text()
              if (t) msg = t
            } catch { /* ignore */ }
          }
          setFetchError(msg)
          setDeliveries([])
          return
        }
        const json = await res.json()
        const list = Array.isArray(json.data) ? json.data : []
        setDeliveries(list)
        setHasMore(list.length >= DELIVERIES_PAGE_SIZE)
      })
      .catch(() => {
        setDeliveries([])
        setFetchError('Failed to load delivery logs. Please close and reopen.')
      })
      .finally(() => setLoading(false))
  }, [open, endpointId])

  const loadMore = () => {
    if (!endpointId || loadingMore || !hasMore) return
    setLoadMoreError(null)
    setLoadingMore(true)
    const offset = deliveries.length
    fetch(`/api/webhooks/${endpointId}/deliveries?limit=${DELIVERIES_PAGE_SIZE}&offset=${offset}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setLoadMoreError('Failed to load more deliveries. Please try again.')
          return
        }
        const json = await res.json()
        const list = Array.isArray(json.data) ? json.data : []
        setDeliveries((prev) => [...prev, ...list])
        setHasMore(list.length >= DELIVERIES_PAGE_SIZE)
      })
      .catch(() => {
        setLoadMoreError('Failed to load more deliveries. Please try again.')
      })
      .finally(() => setLoadingMore(false))
  }

  const formatTime = (s: string | null) => {
    if (!s) return '—'
    const d = new Date(s)
    return d.toLocaleString()
  }

  const retryEligible = deliveries.filter((d) => {
    if (retriedDeliveryIds.has(d.id)) return false
    if (d.can_retry !== undefined) return d.can_retry === true
    return !d.delivered_at && !d.next_retry_at && !d.processing_since
  })

  const deliveryStatus = (d: DeliveryLogEntry): 'success' | 'pending' | 'failed' => {
    if (d.delivered_at) return 'success'
    if (d.processing_since) return 'pending'
    if (d.next_retry_at) return 'pending'
    return (d.attempt_count ?? 0) >= 1 ? 'failed' : 'pending'
  }

  const handleRetryFailed = async () => {
    if (retrying) return
    setRetrying('batch')
    setRetryErrors([])
    setRetrySuccessMessage(null)
    const errors: Array<{ id: string; message: string }> = []
    try {
      const results = await Promise.allSettled(
        retryEligible.map((d) =>
          fetch(`/api/webhooks/deliveries/${d.id}/retry`, {
            method: 'POST',
            credentials: 'include',
          }).then(async (res) => {
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
              const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`
              errors.push({ id: d.id, message: msg })
            } else {
              setRetriedDeliveryIds((prev) => new Set(prev).add(d.id))
              return d.id
            }
          })
        )
      )
      for (const r of results) {
        if (r.status === 'rejected') {
          errors.push({ id: 'unknown', message: r.reason instanceof Error ? r.reason.message : 'Request failed' })
        }
      }
      const successCount = results.filter(
        (r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && !!r.value
      ).length
      setRetryErrors(errors)
      if (successCount > 0) {
        setRetrySuccessMessage('Retry scheduled — a new delivery has been queued.')
      }
      if (endpointId) {
        try {
          const refreshLimit = Math.max(DELIVERIES_PAGE_SIZE, deliveries.length)
          const res = await fetch(`/api/webhooks/${endpointId}/deliveries?limit=${refreshLimit}&offset=0`, { credentials: 'include' })
          if (!res.ok) {
            let msg = `Request failed (${res.status})`
            try {
              const j = await res.json()
              msg = (j as { message?: string }).message ?? (j as { error?: string }).error ?? msg
            } catch {
              try {
                const t = await res.text()
                if (t) msg = t
              } catch { /* ignore */ }
            }
            setFetchError(msg)
          } else {
            const json = await res.json()
            const list = Array.isArray(json.data) ? json.data : []
            setDeliveries(list)
            setHasMore(list.length >= DELIVERIES_PAGE_SIZE)
            setFetchError(null)
          }
          // Do not reset retriedDeliveryIds so already-retried deliveries stay excluded for the modal session
        } catch (e) {
          console.warn('[DeliveryLogsModal] Re-fetch after retry failed:', e)
          setFetchError('Failed to load delivery logs. Please close and reopen.')
        }
      }
    } finally {
      setRetrying(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <GlassCard className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Delivery logs</h2>
            <p className="text-sm text-white/60 truncate max-w-md mt-0.5">{endpointUrl}</p>
            <p className="text-xs text-white/50 mt-0.5">Most recent first. Use “Load more” to see older deliveries. Retried deliveries appear as new entries; the original row stays as Failed.</p>
          </div>
          <div className="flex items-center gap-2">
            {retryEligible.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRetryFailed}
                disabled={!!retrying}
                title="Reschedule for retry (up to 5 attempts)"
              >
                Retry failed ({retryEligible.length})
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-white/70 hover:text-white text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        {retrySuccessMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-sm text-emerald-200">
            {retrySuccessMessage}
          </div>
        )}
        {retryErrors.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-sm text-amber-200">
            <p className="font-medium mb-1">Retry had errors:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {retryErrors.map(({ id, message }) => (
                <li key={id}>
                  <span className="font-mono text-xs">{id.slice(0, 8)}…</span>: {message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {fetchError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-sm text-red-200">
            {fetchError}
          </div>
        )}
        <div className="flex-1 overflow-auto border border-white/10 rounded-lg">
          {loading ? (
            <div className="p-8 text-center text-white/60">Loading…</div>
          ) : fetchError ? (
            <div className="p-8 text-center text-white/60">Failed to load delivery logs. Please close and reopen.</div>
          ) : deliveries.length === 0 ? (
            <div className="p-8 text-center text-white/60">No deliveries yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/80 text-white/70 border-b border-white/10">
                <tr>
                  <th className="text-left p-3 font-medium">Time</th>
                  <th className="text-left p-3 font-medium">Event</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Code</th>
                  <th className="text-left p-3 font-medium">Duration</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="text-white/90">
                {deliveries.map((d) => {
                  const status = deliveryStatus(d)
                  const isExpanded = expandedId === d.id
                  const statusLabel = status === 'success' ? 'Success' : status === 'pending' ? 'Pending' : 'Failed'
                  const statusClass =
                    status === 'success'
                      ? 'text-emerald-400'
                      : status === 'pending'
                        ? 'text-sky-400'
                        : 'text-amber-400'
                  return (
                    <React.Fragment key={d.id}>
                      <tr className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-3 whitespace-nowrap">{formatTime(d.created_at)}</td>
                        <td className="p-3 font-mono text-xs">{d.event_type}</td>
                        <td className="p-3">
                          <span className={statusClass}>{statusLabel}</span>
                        </td>
                        <td className="p-3">{d.response_status ?? '—'}</td>
                        <td className="p-3">{d.duration_ms != null ? `${d.duration_ms}ms` : '—'}</td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : d.id)}
                            className="text-white/70 hover:text-white"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${d.id}-detail`} className="border-b border-white/5 bg-white/5">
                          <td colSpan={6} className="p-4">
                            <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-sm overflow-auto max-h-64 space-y-4">
                              <div>
                                <span className="text-white/60">Request payload (data sent to the external endpoint):</span>
                                <PayloadDisplay
                                  payload={d.payload}
                                  deliveryId={d.id}
                                  showFull={payloadShowFull[d.id]}
                                  onToggleFull={() =>
                                    setPayloadShowFull((prev) => ({
                                      ...prev,
                                      [d.id]: !prev[d.id],
                                    }))
                                  }
                                />
                              </div>
                              {(d.attempts?.length ?? 0) > 0 ? (
                                <div>
                                  <span className="text-white/60">Attempts:</span>
                                  <div className="mt-2 space-y-3">
                                    {d.attempts!.map((a) => (
                                      <div key={a.id} className="rounded bg-black/30 p-3 border border-white/5">
                                        <div className="flex flex-wrap gap-3 text-xs text-white/80 mb-1">
                                          <span>Attempt {a.attempt_number}</span>
                                          <span>{a.response_status != null ? `HTTP ${a.response_status}` : '—'}</span>
                                          <span>{a.duration_ms != null ? `${a.duration_ms}ms` : '—'}</span>
                                          <span>{formatTime(a.created_at)}</span>
                                        </div>
                                        {a.response_body != null && a.response_body !== '' && (
                                          <pre className="mt-1 p-2 rounded bg-black/20 font-mono text-xs whitespace-pre-wrap break-all text-white/90">
                                            {a.response_body}
                                          </pre>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                d.response_body != null && (
                                  <div>
                                    <span className="text-white/60">Response body:</span>
                                    <pre className="mt-1 p-2 rounded bg-black/30 font-mono text-xs whitespace-pre-wrap break-all">
                                      {d.response_body}
                                    </pre>
                                  </div>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && !fetchError && deliveries.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-2">
            {loadMoreError && (
              <p className="text-sm text-amber-200">{loadMoreError}</p>
            )}
            {hasMore && (
              <Button
                variant="secondary"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
