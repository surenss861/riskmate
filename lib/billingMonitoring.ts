/**
 * Billing Monitoring
 * 
 * Helper functions to track webhook failures and create billing alerts.
 */

import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * Track webhook failure
 * 
 * Call this when a webhook handler returns 4xx/5xx
 */
export async function trackWebhookFailure(
  eventType: string,
  stripeEventId: string,
  error: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const serviceSupabase = getServiceSupabase()

    await serviceSupabase.from('billing_alerts').insert({
      alert_type: 'webhook_failure',
      severity: 'critical',
      message: `Webhook failure: ${eventType} (${stripeEventId})`,
      metadata: {
        event_type: eventType,
        stripe_event_id: stripeEventId,
        error,
        correlation_id: stripeEventId, // Use event ID as correlation
        ...metadata,
      },
    })

    console.error('[BillingMonitoring] Webhook failure tracked', {
      event_type: eventType,
      stripe_event_id: stripeEventId,
      error,
    })
  } catch (err: any) {
    // Silent fail - monitoring is non-critical
    console.warn('[BillingMonitoring] Failed to track webhook failure:', err?.message)
  }
}

/**
 * Track reconcile drift
 * 
 * Call this when reconciliation finds mismatches
 */
export async function trackReconcileDrift(
  mismatchCount: number,
  createdCount: number,
  reconciliationLogId: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const serviceSupabase = getServiceSupabase()

    await serviceSupabase.from('billing_alerts').insert({
      alert_type: 'reconcile_drift',
      severity: mismatchCount > 10 ? 'critical' : 'warning',
      message: `Reconciliation found ${mismatchCount} mismatches, ${createdCount} missing subscriptions`,
      metadata: {
        reconciliation_log_id: reconciliationLogId,
        mismatch_count: mismatchCount,
        created_count: createdCount,
        correlation_id: reconciliationLogId, // Use log ID as correlation
        ...metadata,
      },
    })

    console.warn('[BillingMonitoring] Reconcile drift tracked', {
      mismatch_count: mismatchCount,
      created_count: createdCount,
      reconciliation_log_id: reconciliationLogId,
    })
  } catch (err: any) {
    // Silent fail - monitoring is non-critical
    console.warn('[BillingMonitoring] Failed to track reconcile drift:', err?.message)
  }
}

/**
 * Get unresolved billing alerts
 */
export async function getUnresolvedAlerts(
  alertType?: 'webhook_failure' | 'reconcile_drift' | 'status_mismatch',
  limit: number = 50
): Promise<Array<{
  id: string
  alert_type: string
  severity: string
  message: string
  metadata: any
  created_at: string
}>> {
  try {
    const serviceSupabase = getServiceSupabase()
    let query = serviceSupabase
      .from('billing_alerts')
      .select('id, alert_type, severity, message, metadata, created_at')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (alertType) {
      query = query.eq('alert_type', alertType) as any
    }

    const { data, error } = await query

    if (error) {
      console.error('[BillingMonitoring] Failed to get alerts:', error)
      return []
    }

    return data || []
  } catch (err: any) {
    console.error('[BillingMonitoring] Exception getting alerts:', err?.message)
    return []
  }
}

/**
 * Check for monitoring conditions and create alerts
 * 
 * - Alert if no reconcile run in 2 hours
 * - Alert if unresolved high severity alerts > 0 for 30+ mins
 */
export async function checkMonitoringConditions(): Promise<{
  reconcileStale: boolean
  highSeverityStale: boolean
}> {
  try {
    const serviceSupabase = getServiceSupabase()

    // Check 1: No reconcile run in 2 hours
    const { data: lastReconcile } = await serviceSupabase
      .from('reconciliation_logs')
      .select('started_at')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const reconcileStale = !lastReconcile || 
      (Date.now() - new Date(lastReconcile.started_at).getTime()) > 2 * 60 * 60 * 1000

    if (reconcileStale) {
      // Use upsert with alert_key to prevent duplicates
      const alertKey = 'reconcile_stale'
      const { error: upsertError } = await serviceSupabase
        .from('billing_alerts')
        .upsert({
          alert_key: alertKey,
          alert_type: 'reconcile_stale',
          severity: 'warning',
          message: 'No reconciliation run in the last 2 hours. Check cron job configuration.',
          metadata: {
            last_reconcile_at: lastReconcile?.started_at || null,
          },
          resolved: false, // Ensure it's unresolved
        }, {
          onConflict: 'alert_key',
          ignoreDuplicates: false, // Update if exists
        })

      if (upsertError) {
        console.error('[BillingMonitoring] Failed to upsert reconcile_stale alert:', upsertError)
      }
    } else {
      // Condition is no longer stale - auto-resolve any existing alert
      await serviceSupabase
        .from('billing_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('alert_key', 'reconcile_stale')
        .eq('resolved', false)
    }

    // Check 2: High severity alerts unresolved for 30+ mins
    const { data: highSeverityAlerts } = await serviceSupabase
      .from('billing_alerts')
      .select('id, created_at')
      .eq('resolved', false)
      .in('severity', ['critical', 'high'])
      .order('created_at', { ascending: true })

    const highSeverityStale = highSeverityAlerts?.some(alert => {
      const age = Date.now() - new Date(alert.created_at).getTime()
      return age > 30 * 60 * 1000 // 30 minutes
    }) || false

    if (highSeverityStale) {
      // Use upsert with alert_key to prevent duplicates
      const alertKey = 'high_severity_stale'
      const staleCount = highSeverityAlerts?.filter(alert => {
        const age = Date.now() - new Date(alert.created_at).getTime()
        return age > 30 * 60 * 1000
      }).length || 0

      const { error: upsertError } = await serviceSupabase
        .from('billing_alerts')
        .upsert({
          alert_key: alertKey,
          alert_type: 'high_severity_stale',
          severity: 'critical',
          message: `${staleCount} high severity alert(s) unresolved for 30+ minutes`,
          metadata: {
            stale_count: staleCount,
          },
          resolved: false, // Ensure it's unresolved
        }, {
          onConflict: 'alert_key',
          ignoreDuplicates: false, // Update if exists (updates stale_count)
        })

      if (upsertError) {
        console.error('[BillingMonitoring] Failed to upsert high_severity_stale alert:', upsertError)
      }
    } else {
      // Condition is no longer stale - auto-resolve any existing alert
      await serviceSupabase
        .from('billing_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('alert_key', 'high_severity_stale')
        .eq('resolved', false)
    }

    return { reconcileStale, highSeverityStale }
  } catch (err: any) {
    console.error('[BillingMonitoring] Exception checking conditions:', err?.message)
    return { reconcileStale: false, highSeverityStale: false }
  }
}

/**
 * Auto-resolve alerts that are no longer relevant
 * 
 * - Resolve reconcile_drift if mismatch_count becomes 0
 * - Resolve webhook_failure if webhook succeeds on retry (would need webhook success tracking)
 */
export async function autoResolveAlerts(): Promise<{
  resolved_count: number
}> {
  try {
    const serviceSupabase = getServiceSupabase()

    // Get unresolved reconcile_drift alerts
    const { data: driftAlerts } = await serviceSupabase
      .from('billing_alerts')
      .select('id, metadata, created_at')
      .eq('alert_type', 'reconcile_drift')
      .eq('resolved', false)

    let resolvedCount = 0

    for (const alert of driftAlerts || []) {
      const reconciliationLogId = alert.metadata?.reconciliation_log_id
      if (!reconciliationLogId) continue

      // Check latest reconciliation log
      const { data: latestLog } = await serviceSupabase
        .from('reconciliation_logs')
        .select('mismatch_count, created_count')
        .eq('id', reconciliationLogId)
        .maybeSingle()

      // If mismatch_count is 0 and created_count is 0, drift is resolved
      if (latestLog && latestLog.mismatch_count === 0 && latestLog.created_count === 0) {
        await serviceSupabase
          .from('billing_alerts')
          .update({
            resolved: true,
            resolved_at: new Date().toISOString(),
            resolved_by: null, // Auto-resolved
          })
          .eq('id', alert.id)

        resolvedCount++
      }
    }

    return { resolved_count: resolvedCount }
  } catch (err: any) {
    console.error('[BillingMonitoring] Exception auto-resolving:', err?.message)
    return { resolved_count: 0 }
  }
}
