'use client'

import { useEffect, useState } from 'react'
import { Button, GlassCard } from '@/components/shared'

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
  created_at: string
  attempts?: DeliveryAttemptEntry[]
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [retryErrors, setRetryErrors] = useState<Array<{ id: string; message: string }>>([])

  useEffect(() => {
    if (!open || !endpointId) return
    setLoading(true)
    fetch(`/api/webhooks/${endpointId}/deliveries?limit=50`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        setDeliveries(Array.isArray(json.data) ? json.data : [])
      })
      .catch(() => setDeliveries([]))
      .finally(() => setLoading(false))
  }, [open, endpointId])

  const formatTime = (s: string | null) => {
    if (!s) return '—'
    const d = new Date(s)
    return d.toLocaleString()
  }

  const retryEligible = deliveries.filter(
    (d) => !d.delivered_at && !d.next_retry_at && (d.attempt_count ?? 0) >= 1
  )

  const deliveryStatus = (d: DeliveryLogEntry): 'success' | 'pending' | 'failed' => {
    if (d.delivered_at) return 'success'
    if (d.next_retry_at) return 'pending'
    return (d.attempt_count ?? 0) >= 1 ? 'failed' : 'pending'
  }

  const handleRetryFailed = async () => {
    setRetryErrors([])
    const errors: Array<{ id: string; message: string }> = []
    for (const d of retryEligible) {
      setRetrying(d.id)
      try {
        const res = await fetch(`/api/webhooks/deliveries/${d.id}/retry`, {
          method: 'POST',
          credentials: 'include',
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = json?.message ?? json?.error ?? `HTTP ${res.status}`
          errors.push({ id: d.id, message: msg })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed'
        errors.push({ id: d.id, message: msg })
      } finally {
        setRetrying(null)
      }
    }
    setRetryErrors(errors)
    if (endpointId) {
      try {
        const res = await fetch(`/api/webhooks/${endpointId}/deliveries?limit=50`, { credentials: 'include' })
        const json = await res.json()
        setDeliveries(Array.isArray(json.data) ? json.data : [])
      } catch (e) {
        console.warn('[DeliveryLogsModal] Re-fetch after retry failed:', e)
      }
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
          </div>
          <div className="flex items-center gap-2">
            {retryEligible.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRetryFailed}
                disabled={!!retrying}
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
        <div className="flex-1 overflow-auto border border-white/10 rounded-lg">
          {loading ? (
            <div className="p-8 text-center text-white/60">Loading…</div>
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
                    <tr key={d.id} className="border-b border-white/5 hover:bg-white/5">
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
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {deliveries.some((d) => expandedId === d.id) && (
          <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-4 text-sm overflow-auto max-h-64">
            {deliveries
              .filter((d) => d.id === expandedId)
              .map((d) => (
                <div key={d.id} className="space-y-4">
                  <div>
                    <span className="text-white/60">Request payload:</span>
                    <pre className="mt-1 p-2 rounded bg-black/30 font-mono text-xs whitespace-pre-wrap break-all">
                      {JSON.stringify(d.payload ?? {}, null, 2)}
                    </pre>
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
              ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
