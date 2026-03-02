'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { AppBackground, AppShell, PageSection, GlassCard, Button, PageHeader, Badge } from '@/components/shared'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { AddWebhookModal, type WebhookEndpoint, type WebhookEndpointWithSecret } from '@/components/webhooks/AddWebhookModal'
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
  const [refreshing, setRefreshing] = useState(false)
  const [canManage, setCanManage] = useState(true)
  const [defaultOrganizationId, setDefaultOrganizationId] = useState<string | null>(null)
  const [organizationOptions, setOrganizationOptions] = useState<{ id: string; name: string }[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [logsEndpoint, setLogsEndpoint] = useState<{ id: string; url: string } | null>(null)
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingConfirmId, setDeletingConfirmId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [statsLoadFailed, setStatsLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFetchError(null)
    setStatsLoadFailed(false)
    const endpointsPromise = fetch('/api/webhooks', { credentials: 'include' }).then(async (r) => ({ status: r.status, json: await r.json() }))
    const statsPromise = fetch('/api/webhooks/stats', { credentials: 'include' }).then(async (r) => ({ status: r.status, json: await r.json() }))
    Promise.allSettled([endpointsPromise, statsPromise])
      .then(([endpointsResult, statsResult]) => {
        if (cancelled) return
        const endpointsRes = endpointsResult.status === 'fulfilled' ? endpointsResult.value : null
        const statsRes = statsResult.status === 'fulfilled' ? statsResult.value : null
        if (endpointsResult.status === 'rejected') {
          setFetchError('Failed to load webhooks. Please refresh the page.')
          setEndpoints([])
          setStats({})
          return
        }
        if (!endpointsRes) return
        const endpointsJson = endpointsRes.json
        if (endpointsRes.status === 403) {
          setCanManage(false)
          setEndpoints([])
          setStats({})
          return
        }
        if (endpointsRes.status < 200 || endpointsRes.status >= 300) {
          setFetchError('Failed to load webhooks. Please refresh the page.')
          setEndpoints([])
          setStats({})
          return
        }
        const eps = Array.isArray(endpointsJson?.data) ? endpointsJson.data : []
        setCanManage(true)
        setEndpoints(eps)
        setDefaultOrganizationId(endpointsJson?.default_organization_id ?? null)
        setOrganizationOptions(Array.isArray(endpointsJson?.organization_options) ? endpointsJson.organization_options : [])
        if (statsResult.status === 'rejected' || !statsRes) {
          setStatsLoadFailed(true)
          setStats({})
          return
        }
        const statsJson = statsRes.json
        const data = statsJson?.data ?? {}
        const next: Record<string, DeliveryStats> = {}
        for (const ep of eps) {
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
        // Show warning banner when degraded or non-2xx, but keep partial stats
        if (statsJson?.degraded === true || !statsRes.status || statsRes.status < 200 || statsRes.status >= 300) {
          setStatsLoadFailed(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const loadStatsOnly = async (endpointList: WebhookEndpoint[]) => {
    setStatsLoadFailed(false)
    if (endpointList.length === 0) {
      setStats({})
      return
    }
    try {
      const res = await fetch('/api/webhooks/stats', { credentials: 'include' })
      if (!res.ok) {
        setStatsLoadFailed(true)
        return
      }
      const json = await res.json().catch(() => ({}))
      if (json.degraded === true) {
        setStatsLoadFailed(true)
      }
      const data = json.data ?? {}
      const next: Record<string, DeliveryStats> = {}
      for (const ep of endpointList) {
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
      setStatsLoadFailed(true)
    }
  }

  const loadEndpoints = async () => {
    setRefreshing(true)
    setFetchError(null)
    setStatsLoadFailed(false)
    try {
      const res = await fetch('/api/webhooks', { credentials: 'include' })
      const json = await res.json()
      if (res.status === 403) {
        setCanManage(false)
        setEndpoints([])
        return
      }
      if (res.status < 200 || res.status >= 300) {
        setFetchError('Failed to load webhooks. Please refresh the page.')
        setEndpoints([])
        return
      }
      setCanManage(true)
      const eps = Array.isArray(json.data) ? json.data : []
      setEndpoints(eps)
      setDefaultOrganizationId(json.default_organization_id ?? null)
      setOrganizationOptions(Array.isArray(json.organization_options) ? json.organization_options : [])
      await loadStatsOnly(eps)
    } catch {
      setEndpoints([])
      setFetchError('Failed to load webhooks. Please refresh the page.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreated = (_endpoint: WebhookEndpointWithSecret | WebhookEndpoint) => {
    setAddOpen(false)
    loadEndpoints()
  }

  const handleTest = async (id: string) => {
    setActionError(null)
    setActionSuccess(null)
    setTestingId(id)
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST', credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = (json as { message?: string }).message ?? 'Test request failed'
        setActionError(msg)
        return
      }
      setActionError(null)
      setActionSuccess('Test event queued — stats will update shortly.')
    } finally {
      setTestingId(null)
    }
  }

  const handleDeleteClick = (id: string) => {
    setActionError(null)
    setDeletingConfirmId(id)
  }

  const handleDeleteConfirm = async () => {
    const id = deletingConfirmId
    if (!id) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        const msg = (json as { message?: string }).message ?? 'Delete failed'
        setActionError(msg)
        return
      }
      await loadEndpoints()
    } finally {
      setDeletingId(null)
      setDeletingConfirmId(null)
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

  // Show Failing only when there are terminal failures (no more retries) after last success.
  // Stats exclude intentional cancellations (cancelled_paused, cancelled_policy), so paused endpoints do not show as Failing.
  const isFailing = (epId: string) => {
    const s = stats[epId]
    const lastTerminal = s?.lastTerminalFailureAt ?? null
    if (!s || !lastTerminal) return false
    if (!s.lastSuccessAt) return true
    return new Date(lastTerminal) > new Date(s.lastSuccessAt)
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
            {actionSuccess && (
              <div className="mb-4 p-4 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 flex items-center justify-between gap-2">
                <span>{actionSuccess}</span>
                <button
                  type="button"
                  onClick={() => setActionSuccess(null)}
                  className="shrink-0 text-white/80 hover:text-white"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}
            {actionError && (
              <div className="mb-4 p-4 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 flex items-center justify-between gap-2">
                <span>{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  className="shrink-0 text-white/80 hover:text-white"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}
            {!loading && fetchError && (
              <div className="mb-4 p-4 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 flex items-center justify-between gap-2">
                <span>{fetchError}</span>
                <button
                  type="button"
                  onClick={() => { setFetchError(null); loadEndpoints(); }}
                  className="shrink-0 text-white/80 hover:text-white underline"
                >
                  Retry
                </button>
              </div>
            )}
            {!loading && statsLoadFailed && endpoints.length > 0 && (
              <div className="mb-4 p-4 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 flex items-center justify-between gap-2">
                <span>Delivery stats could not be loaded. Refresh the page or click Retry to try again.</span>
                <button
                  type="button"
                  onClick={() => { setStatsLoadFailed(false); loadStatsOnly(endpoints); }}
                  className="shrink-0 text-amber-100 hover:text-white underline"
                >
                  Retry
                </button>
              </div>
            )}
            {canManage && !fetchError && (
              <div className="flex justify-end mb-6">
                <Button onClick={() => setAddOpen(true)} disabled={refreshing}>Add endpoint</Button>
              </div>
            )}

            {loading ? (
              <div className="text-white/60">Loading…</div>
            ) : !canManage ? (
              <GlassCard className="p-8 text-center text-white/70">
                <p className="mb-4">Only owners and admins can view and manage webhook endpoints.</p>
                <p className="text-sm text-white/50">Ask an organization owner or admin to grant you access or to manage webhooks.</p>
              </GlassCard>
            ) : endpoints.length === 0 ? (
              fetchError ? (
                <GlassCard className="p-8 text-center text-white/70">
                  <p className="mb-4">Could not load webhooks. Use the Retry button above to try again.</p>
                </GlassCard>
              ) : (
                <GlassCard className="p-8 text-center text-white/70">
                  <p className="mb-4">No webhook endpoints yet.</p>
                  <Button onClick={() => setAddOpen(true)}>Add your first endpoint</Button>
                </GlassCard>
              )
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
                          <Badge variant={statsLoadFailed ? 'neutral' : isFailing(ep.id) ? 'critical' : ep.is_active ? 'success' : 'neutral'}>
                            {statsLoadFailed ? (ep.is_active ? 'Active' : 'Paused') : isFailing(ep.id) ? 'Failing' : ep.is_active ? 'Active' : 'Paused'}
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
                      {canManage && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setLogsEndpoint({ id: ep.id, url: ep.url })}
                            disabled={refreshing}
                          >
                            View logs
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingEndpoint(ep)}
                            disabled={refreshing}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleTest(ep.id)}
                            disabled={!!testingId || !ep.is_active || refreshing}
                            title={!ep.is_active ? 'Resume the endpoint to send a test' : undefined}
                          >
                            {testingId === ep.id ? 'Sending…' : 'Send test'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDeleteClick(ep.id)}
                            disabled={!!deletingId || refreshing}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
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
        organizationId={defaultOrganizationId}
        organizationOptions={organizationOptions}
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
      <ConfirmModal
        isOpen={deletingConfirmId !== null}
        title="Delete webhook endpoint"
        message="Remove this webhook endpoint? Events will no longer be sent to this URL."
        consequence="This cannot be undone."
        confirmLabel="Delete endpoint"
        destructive
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingConfirmId(null)}
      />
    </ProtectedRoute>
  )
}
