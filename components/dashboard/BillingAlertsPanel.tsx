'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface BillingAlert {
  id: string
  alert_type: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  metadata: any
  created_at: string
  resolved: boolean
}

export function BillingAlertsPanel() {
  const [alerts, setAlerts] = useState<BillingAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAlerts()
    // Refresh every 5 minutes
    const interval = setInterval(loadAlerts, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/admin/billing-alerts')
      if (!response.ok) {
        throw new Error('Failed to load alerts')
      }
      const data = await response.json()
      setAlerts(data.alerts || [])
      setError(null)
    } catch (err: any) {
      console.error('Failed to load billing alerts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const markResolved = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/billing-alerts/${alertId}/resolve`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to resolve alert')
      }
      // Reload alerts
      await loadAlerts()
    } catch (err: any) {
      console.error('Failed to resolve alert:', err)
      alert('Failed to resolve alert: ' + err.message)
    }
  }

  const triggerReconcile = async () => {
    try {
      const response = await fetch('/api/admin/billing-alerts/reconcile', {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to trigger reconciliation')
      }
      const result = await response.json()
      alert(`Reconciliation triggered: ${result.message}`)
      // Reload alerts after a short delay (reconcile may create new alerts)
      setTimeout(loadAlerts, 2000)
    } catch (err: any) {
      console.error('Failed to trigger reconcile:', err)
      alert('Failed to trigger reconciliation: ' + err.message)
    }
  }

  const unresolvedAlerts = alerts.filter(a => !a.resolved)
  const criticalAlerts = unresolvedAlerts.filter(a => a.severity === 'critical')
  const warningAlerts = unresolvedAlerts.filter(a => a.severity === 'warning')

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-white/10 rounded w-32 mb-2"></div>
          <div className="h-3 bg-white/5 rounded w-48"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <p className="text-red-400 text-sm">Failed to load billing alerts: {error}</p>
      </div>
    )
  }

  if (unresolvedAlerts.length === 0) {
    return null // Don't show panel if no alerts
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/5 border rounded-xl p-4 ${
        criticalAlerts.length > 0
          ? 'border-red-500/50 bg-red-500/5'
          : 'border-yellow-500/50 bg-yellow-500/5'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">
            Billing Alerts ({unresolvedAlerts.length})
          </span>
          {criticalAlerts.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-semibold rounded">
              {criticalAlerts.length} Critical
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerReconcile}
            className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
            title="Trigger reconciliation now"
          >
            Reconcile Now
          </button>
          <button
            onClick={loadAlerts}
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {unresolvedAlerts.slice(0, 5).map((alert) => (
          <div
            key={alert.id}
            className="flex items-start justify-between gap-3 p-2 bg-black/20 rounded"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-semibold ${
                    alert.severity === 'critical'
                      ? 'text-red-400'
                      : alert.severity === 'warning'
                      ? 'text-yellow-400'
                      : 'text-blue-400'
                  }`}
                >
                  {alert.severity.toUpperCase()}
                </span>
                <span className="text-xs text-white/50">
                  {new Date(alert.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-white/80">{alert.message}</p>
              {alert.metadata?.stripe_event_id && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-white/50">
                    Event: {alert.metadata.stripe_event_id}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(alert.metadata.stripe_event_id)
                      // Could add toast notification here
                    }}
                    className="text-xs text-white/40 hover:text-white/80 transition-colors"
                    title="Copy event ID"
                  >
                    📋
                  </button>
                </div>
              )}
              {alert.metadata?.correlation_id && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-white/50">
                    Correlation: {alert.metadata.correlation_id}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(alert.metadata.correlation_id)
                    }}
                    className="text-xs text-white/40 hover:text-white/80 transition-colors"
                    title="Copy correlation ID"
                  >
                    📋
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => markResolved(alert.id)}
                className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
              >
                Mark Resolved
              </button>
              {(alert.metadata?.stripe_event_id || alert.metadata?.correlation_id) && (
                <button
                  onClick={() => {
                    // Link to logs filtered by correlation ID
                    const filterId = alert.metadata?.correlation_id || alert.metadata?.stripe_event_id
                    window.open(`/operations/audit?filter=${filterId}`, '_blank')
                  }}
                  className="text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-1 rounded hover:bg-white/5"
                  title="View related logs"
                >
                  View Logs
                </button>
              )}
            </div>
          </div>
        ))}
        {unresolvedAlerts.length > 5 && (
          <p className="text-xs text-white/50 text-center">
            +{unresolvedAlerts.length - 5} more alerts
          </p>
        )}
      </div>
    </motion.div>
  )
}
