'use client'

import { GlassCard, Button, Badge } from '@/components/shared'
import type { WebhookEndpoint } from '@/components/webhooks/AddWebhookModal'

interface DeliveryStats {
  delivered: number
  pending: number
  failed: number
  lastDelivery: string | null
  lastSuccessAt: string | null
  lastTerminalFailureAt: string | null
  lastFailureAt: string | null
}

export interface WebhookEndpointCardProps {
  endpoint: WebhookEndpoint
  stats: DeliveryStats | undefined
  statsLoadFailed: boolean
  isFailing: (endpointId: string) => boolean
  formatLast: (s: string | null) => string
  canManage: boolean
  refreshing: boolean
  testingId: string | null
  deletingId: string | null
  organizationOptions: { id: string; name: string }[]
  onViewLogs: (endpoint: WebhookEndpoint) => void
  onEdit: (endpoint: WebhookEndpoint) => void
  onTest: (endpointId: string) => void
  onDeleteClick: (endpointId: string) => void
}

export function WebhookEndpointCard({
  endpoint: ep,
  stats,
  statsLoadFailed,
  isFailing,
  formatLast,
  canManage,
  refreshing,
  testingId,
  deletingId,
  organizationOptions,
  onViewLogs,
  onEdit,
  onTest,
  onDeleteClick,
}: WebhookEndpointCardProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {organizationOptions.length > 1 && ep.organization_id && (
              <span className="text-xs text-white/60 shrink-0">
                {organizationOptions.find((o) => o.id === ep.organization_id)?.name ?? ep.organization_id}
              </span>
            )}
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
            <span>✓ {stats?.delivered ?? 0} delivered</span>
            <span>⋯ {stats?.pending ?? 0} pending</span>
            <span>✗ {stats?.failed ?? 0} failed</span>
            <span>Last: {formatLast(stats?.lastDelivery ?? null)}</span>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewLogs(ep)}
              disabled={refreshing}
            >
              View logs
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(ep)}
              disabled={refreshing}
            >
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onTest(ep.id)}
              disabled={!!testingId || !ep.is_active || refreshing}
              title={!ep.is_active ? 'Resume the endpoint to send a test' : undefined}
            >
              {testingId === ep.id ? 'Sending…' : 'Send test'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDeleteClick(ep.id)}
              disabled={!!deletingId || refreshing}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </GlassCard>
  )
}
