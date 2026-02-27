'use client'

import { useEffect, useState } from 'react'
import { Button, GlassCard } from '@/components/shared'

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

  const failed = deliveries.filter((d) => !d.delivered_at && d.attempt_count >= 1)

  const handleRetryFailed = async () => {
    for (const d of failed) {
      setRetrying(d.id)
      try {
        await fetch(`/api/webhooks/deliveries/${d.id}/retry`, {
          method: 'POST',
          credentials: 'include',
        })
      } catch {
        // ignore per-item errors
      } finally {
        setRetrying(null)
      }
    }
    if (endpointId) {
      const res = await fetch(`/api/webhooks/${endpointId}/deliveries?limit=50`, { credentials: 'include' })
      const json = await res.json()
      setDeliveries(Array.isArray(json.data) ? json.data : [])
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
            {failed.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRetryFailed}
                disabled={!!retrying}
              >
                Retry failed ({failed.length})
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
                  const success = !!d.delivered_at
                  const isExpanded = expandedId === d.id
                  return (
                    <tr key={d.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3 whitespace-nowrap">{formatTime(d.created_at)}</td>
                      <td className="p-3 font-mono text-xs">{d.event_type}</td>
                      <td className="p-3">
                        <span
                          className={
                            success
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }
                        >
                          {success ? 'Success' : 'Failed'}
                        </span>
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
          <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-4 text-sm overflow-auto max-h-48">
            {deliveries
              .filter((d) => d.id === expandedId)
              .map((d) => (
                <div key={d.id} className="space-y-3">
                  <div>
                    <span className="text-white/60">Request payload:</span>
                    <pre className="mt-1 p-2 rounded bg-black/30 font-mono text-xs whitespace-pre-wrap break-all">
                      {JSON.stringify(d.payload ?? {}, null, 2)}
                    </pre>
                  </div>
                  {d.response_body != null && (
                    <div>
                      <span className="text-white/60">Response body:</span>
                      <pre className="mt-1 p-2 rounded bg-black/30 font-mono text-xs whitespace-pre-wrap break-all">
                        {d.response_body}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
