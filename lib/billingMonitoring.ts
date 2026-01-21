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
