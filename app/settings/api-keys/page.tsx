'use client'

import { useEffect, useState, useCallback } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { AppBackground, AppShell, PageSection, GlassCard, Button, PageHeader } from '@/components/shared'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { CreateApiKeyModal, type ApiKeyRow } from '@/components/api-keys/CreateApiKeyModal'

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    setRefreshing(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/api-keys', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (res.status === 403) {
        setCanManage(false)
        setKeys([])
        return
      }
      if (res.status < 200 || res.status >= 300) {
        setFetchError((json as { message?: string }).message ?? 'Failed to load API keys')
        setKeys([])
        return
      }
      setCanManage(true)
      setKeys(Array.isArray(json?.data) ? json.data : [])
    } catch {
      setFetchError('Failed to load API keys')
      setKeys([])
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const handleCreated = () => {
    setActionSuccess('API key created. Save it somewhere safe — it won’t be shown again.')
    loadKeys()
  }

  const handleRevokeClick = (id: string) => {
    setActionError(null)
    setRevokeConfirmId(id)
  }

  const handleRevokeConfirm = async () => {
    const id = revokeConfirmId
    if (!id) return
    setRevokingId(id)
    try {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setActionError((json as { message?: string }).message ?? 'Revoke failed')
        return
      }
      setActionSuccess('API key revoked.')
      await loadKeys()
    } finally {
      setRevokingId(null)
      setRevokeConfirmId(null)
    }
  }

  const formatDate = (s: string | null) => {
    if (!s) return 'Never'
    const d = new Date(s)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatLastUsed = (s: string | null) => {
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

  return (
    <ProtectedRoute>
      <AppBackground>
        <DashboardNavbar />
        <AppShell>
          <PageSection className="max-w-4xl mx-auto">
            <PageHeader
              title="API keys"
              subtitle="Create and manage API keys for the Public API. Use keys with scopes to access jobs, hazards, and reports."
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
                  onClick={() => { setFetchError(null); loadKeys(); }}
                  className="shrink-0 text-white/80 hover:text-white underline"
                >
                  Retry
                </button>
              </div>
            )}
            {canManage && !fetchError && (
              <div className="flex justify-end mb-6">
                <Button onClick={() => setAddOpen(true)} disabled={refreshing}>
                  Create API key
                </Button>
              </div>
            )}

            {loading ? (
              <div className="text-white/60">Loading…</div>
            ) : !canManage ? (
              <GlassCard className="p-8 text-center text-white/70">
                <p className="mb-4">Only owners and admins can view and manage API keys.</p>
                <p className="text-sm text-white/50">Ask an organization owner or admin to grant you access.</p>
              </GlassCard>
            ) : keys.length === 0 ? (
              fetchError ? (
                <GlassCard className="p-8 text-center text-white/70">
                  <p className="mb-4">Could not load API keys. Use the Retry button above to try again.</p>
                </GlassCard>
              ) : (
                <GlassCard className="p-8 text-center text-white/70">
                  <p className="mb-4">No API keys yet.</p>
                  <Button onClick={() => setAddOpen(true)}>Create your first API key</Button>
                </GlassCard>
              )
            ) : (
              <div className="space-y-4">
                {keys.map((key) => (
                  <GlassCard
                    key={key.id}
                    className={`p-4 ${key.revoked_at ? 'opacity-60' : ''}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white">{key.name}</span>
                          {key.revoked_at && (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/30 text-red-200">
                              REVOKED
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-sm text-white/70">
                          {key.key_prefix}••••••••••••••••••••••••••••••
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(key.scopes ?? []).map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/80 font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-white/50">
                          Created {formatDate(key.created_at)}
                          {' · '}
                          Last used {formatLastUsed(key.last_used_at)}
                          {key.expires_at && ` · Expires ${formatDate(key.expires_at)}`}
                          {key.revoked_at && ` · Revoked ${formatDate(key.revoked_at)}`}
                        </p>
                      </div>
                      {!key.revoked_at && canManage && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-red-300 border-red-400/50 hover:bg-red-500/20"
                          onClick={() => handleRevokeClick(key.id)}
                          disabled={revokingId === key.id}
                        >
                          {revokingId === key.id ? 'Revoking…' : 'Revoke'}
                        </Button>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </PageSection>
        </AppShell>
      </AppBackground>

      <CreateApiKeyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />

      <ConfirmModal
        isOpen={!!revokeConfirmId}
        title="Revoke API key?"
        message="This key will stop working immediately. This cannot be undone."
        confirmLabel="Revoke"
        onConfirm={handleRevokeConfirm}
        onCancel={() => setRevokeConfirmId(null)}
        destructive
      />
    </ProtectedRoute>
  )
}
