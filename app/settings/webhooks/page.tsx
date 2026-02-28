'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { AppBackground, AppShell, PageSection, GlassCard, Button, PageHeader, Badge } from '@/components/shared'
import { AddWebhookModal, type WebhookEndpoint } from '@/components/webhooks/AddWebhookModal'
import { EditWebhookModal } from '@/components/webhooks/EditWebhookModal'
import { DeliveryLogsModal } from '@/components/webhooks/DeliveryLogsModal'

interface DeliveryStats {
  delivered: number
  pending: number
  failed: number
  lastDelivery: string | null
  lastSuccessAt: string | null
  lastTerminalFailureAt: string | null
  lastFailureAt: string | null
}

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [stats, setStats] = useState<Record<string, DeliveryStats>>({})
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [logsEndpoint, setLogsEndpoint] = useState<{ id: string; url: string } | null>(null)
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadEndpoints = async () => {
    try {
      const res = await fetch('/api/webhooks', { credentials: 'include' })
      const json = await res.json()
      setEndpoints(Array.isArray(json.data) ? json.data : [])
    } catch {
      setEndpoints([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEndpoints()
  }, [])

  useEffect(() => {
    if (endpoints.length === 0) return
    const loadStats = async () => {
      try {
        const res = await fetch('/api/webhooks/stats', { credentials: 'include' })
        const json = await res.json()
        const data = json.data ?? {}
        const next: Record<string, DeliveryStats> = {}
        for (const ep of endpoints) {
          const s = data[ep.id]
          next[ep.id] = s
            ? {
                delivered: s.delivered ?? 0,
                pending: s.pending ?? 0,
                failed: s.failed ?? 0,
                lastDelivery: s.lastDelivery ?? null,
                lastSuccessAt: s.lastSuccessAt ?? null,
                lastTerminalFailureAt: s.lastTerminalFailureAt ?? null,
                lastFailureAt: s.lastFailureAt ?? null,
              }
            : { delivered: 0, pending: 0, failed: 0, lastDelivery: null, lastSuccessAt: null, lastTerminalFailureAt: null, lastFailureAt: null }
        }
        setStats(next)
      } catch {
        const fallback: Record<string, DeliveryStats> = {}
        for (const ep of endpoints) {
          fallback[ep.id] = { delivered: 0, pending: 0, failed: 0, lastDelivery: null, lastSuccessAt: null, lastTerminalFailureAt: null, lastFailureAt: null }
        }
        setStats(fallback)
      }
    }
    loadStats()
  }, [endpoints])

  const handleCreated = () => {
    setAddOpen(false)
    loadEndpoints()
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST', credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (json as { message?: string }).message ?? 'Test request failed'
        alert(msg)
        return
      }
      await loadEndpoints()
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook endpoint? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await fetch(`/api/webhooks/${id}`, { method: 'DELETE', credentials: 'include' })
      await loadEndpoints()
    } finally {
      setDeletingId(null)
    }
  }

  const formatLast = (s: string | null) => {
    if (!s) return 'Never'
    const d = new Date(s)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffM = Math.floor(diffMs / 60000)
    if (diffM < 1) return 'Just now'
    if (diffM < 60) return `${diffM} min ago`
    const diffH = Math.floor(diffM / 60)
    if (diffH < 24) return `${diffH} hr ago`
    return `${Math.floor(diffH / 24)} days ago`
  }

  // Show Failing when latest failure (any attempt, including during retries) is after last success,
  // so endpoints show failing state immediately after unsuccessful attempts, not only after terminal exhaustion.
  const isFailing = (epId: string) => {
    const s = stats[epId]
    const lastFailure = s?.lastFailureAt ?? s?.lastTerminalFailureAt ?? null
    if (!s || !lastFailure) return false
    if (!s.lastSuccessAt) return true
    return new Date(lastFailure) > new Date(s.lastSuccessAt)
  }

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar />
        <AppShell>
          <PageSection className="max-w-4xl mx-auto">
            <PageHeader
              title="Webhooks"
              subtitle="Send events to your own endpoints when jobs, hazards, and reports change."
            />
            <div className="flex justify-end mb-6">
              <Button onClick={() => setAddOpen(true)}>Add endpoint</Button>
            </div>

            {loading ? (
              <div className="text-white/60">Loading…</div>
            ) : endpoints.length === 0 ? (
              <GlassCard className="p-8 text-center text-white/70">
                <p className="mb-4">No webhook endpoints yet.</p>
                <Button onClick={() => setAddOpen(true)}>Add your first endpoint</Button>
              </GlassCard>
            ) : (
              <div className="space-y-4">
                {endpoints.map((ep) => (
                  <GlassCard key={ep.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-white truncate max-w-md">
                            {ep.url}
                          </span>
                          <Badge variant={isFailing(ep.id) ? 'critical' : ep.is_active ? 'success' : 'neutral'}>
                            {isFailing(ep.id) ? 'Failing' : ep.is_active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        {ep.description && (
                          <p className="text-sm text-white/60 mt-1">{ep.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(ep.events || []).slice(0, 5).map((e) => (
                            <span
                              key={e}
                              className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/80 font-mono"
                            >
                              {e}
                            </span>
                          ))}
                          {(ep.events?.length ?? 0) > 5 && (
                            <span className="text-xs text-white/50">
                              +{(ep.events?.length ?? 0) - 5} more
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-white/60">
                          <span>✓ {stats[ep.id]?.delivered ?? 0} delivered</span>
                          <span>⋯ {stats[ep.id]?.pending ?? 0} pending</span>
                          <span>✗ {stats[ep.id]?.failed ?? 0} failed</span>
                          <span>Last: {formatLast(stats[ep.id]?.lastDelivery ?? null)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setLogsEndpoint({ id: ep.id, url: ep.url })}
                        >
                          View logs
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingEndpoint(ep)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleTest(ep.id)}
                          disabled={!!testingId || !ep.is_active}
                          title={!ep.is_active ? 'Resume the endpoint to send a test' : undefined}
                        >
                          {testingId === ep.id ? 'Sending…' : 'Send test'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDelete(ep.id)}
                          disabled={!!deletingId}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            <p className="mt-6 text-sm text-white/50">
              <Link href="/operations/account" className="underline hover:text-white/70">
                ← Back to account
              </Link>
            </p>
          </PageSection>
        </AppShell>
      </AppBackground>

      <AddWebhookModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />
      {logsEndpoint && (
        <DeliveryLogsModal
          open={!!logsEndpoint}
          endpointId={logsEndpoint.id}
          endpointUrl={logsEndpoint.url}
          onClose={() => setLogsEndpoint(null)}
        />
      )}
      <EditWebhookModal
        open={!!editingEndpoint}
        endpoint={editingEndpoint}
        onClose={() => setEditingEndpoint(null)}
        onSaved={() => { setEditingEndpoint(null); loadEndpoints(); }}
      />
    </ProtectedRoute>
  )
}
