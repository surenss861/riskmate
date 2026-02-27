/**
 * Webhook delivery: enqueue deliveries for events, send with HMAC signature, retry with backoff.
 * Retry: 5min → 30min → 2hr → 24hr → fail. Alert org admin after 5 consecutive failures.
 */

import crypto from 'crypto'
import { supabase } from '../lib/supabaseClient'
import { buildSignatureHeaders } from '../utils/webhookSigning'
import { sendEmail } from '../utils/email'

const RETRY_DELAYS_MS = [
  0,           // attempt 1: immediate
  5 * 60 * 1000,   // 5 min
  30 * 60 * 1000,  // 30 min
  2 * 60 * 60 * 1000,  // 2 hr
  24 * 60 * 60 * 1000, // 24 hr
]

const MAX_ATTEMPTS = 5
const CONSECUTIVE_FAILURES_BEFORE_ALERT = 5
const WEBHOOK_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24h dedupe

export type WebhookEventType =
  | 'job.created'
  | 'job.updated'
  | 'job.completed'
  | 'job.deleted'
  | 'hazard.created'
  | 'hazard.updated'
  | 'signature.added'
  | 'report.generated'
  | 'evidence.uploaded'
  | 'team.member_added'

export interface WebhookEventPayload {
  id: string
  type: string
  created: string
  organization_id: string
  data: Record<string, unknown>
}

interface WebhookEndpointRow {
  id: string
  organization_id: string
  url: string
  secret: string
  events: string[]
  is_active: boolean
}

interface WebhookDeliveryRow {
  id: string
  endpoint_id: string
  event_type: string
  payload: Record<string, unknown>
  response_status: number | null
  response_body: string | null
  duration_ms: number | null
  attempt_count: number
  delivered_at: string | null
  next_retry_at: string | null
  created_at: string
}

/**
 * Build the standard event payload envelope.
 */
export function buildWebhookPayload(
  eventType: string,
  organizationId: string,
  data: Record<string, unknown>
): WebhookEventPayload {
  return {
    id: `evt_${crypto.randomUUID()}`,
    type: eventType,
    created: new Date().toISOString(),
    organization_id: organizationId,
    data: { object: data },
  }
}

/**
 * Find active endpoints for org that subscribe to this event type; create one delivery row per endpoint.
 */
export async function deliverEvent(
  orgId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  const payload = buildWebhookPayload(eventType, orgId, data)
  const payloadJson = JSON.stringify(payload)

  const { data: endpoints, error: fetchError } = await supabase
    .from('webhook_endpoints')
    .select('id, organization_id, url, secret, events, is_active')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (fetchError) {
    console.error('[WebhookDelivery] Fetch endpoints failed:', fetchError)
    throw new Error(`Webhook endpoints fetch failed: ${fetchError.message}`)
  }

  const filtered = (endpoints || []).filter(
    (e: WebhookEndpointRow) => e.events && e.events.includes(eventType)
  )

  for (const ep of filtered) {
    const { error: insertError } = await supabase.from('webhook_deliveries').insert({
      endpoint_id: ep.id,
      event_type: eventType,
      payload: payload as unknown as Record<string, unknown>,
      attempt_count: 1,
      next_retry_at: new Date().toISOString(),
    })
    if (insertError) {
      console.error('[WebhookDelivery] Insert delivery failed:', insertError)
    }
  }
}

/**
 * Record one send attempt in webhook_delivery_attempts for immutable per-attempt history.
 */
async function recordAttempt(
  deliveryId: string,
  attemptNumber: number,
  responseStatus: number | null,
  responseBody: string | null,
  durationMs: number
): Promise<void> {
  await supabase.from('webhook_delivery_attempts').insert({
    delivery_id: deliveryId,
    attempt_number: attemptNumber,
    response_status: responseStatus,
    response_body: responseBody,
    duration_ms: durationMs,
  })
}

/**
 * Send one delivery: POST to endpoint URL with signed payload, update row, record attempt.
 */
export async function sendDelivery(delivery: WebhookDeliveryRow): Promise<void> {
  const { data: endpoint, error: epError } = await supabase
    .from('webhook_endpoints')
    .select('url, secret')
    .eq('id', delivery.endpoint_id)
    .single()

  if (epError || !endpoint) {
    console.error('[WebhookDelivery] Endpoint not found:', delivery.endpoint_id)
    const attemptNumber = delivery.attempt_count
    await recordAttempt(delivery.id, attemptNumber, null, 'Endpoint not found (missing or deleted)', 0)
    // Terminalize so this row is not retried indefinitely (missing/deleted endpoint is undeliverable)
    await supabase
      .from('webhook_deliveries')
      .update({
        response_status: null,
        response_body: 'Endpoint not found (missing or deleted)',
        duration_ms: 0,
        next_retry_at: null,
      })
      .eq('id', delivery.id)
    return
  }

  const payloadStr = JSON.stringify(delivery.payload)
  const headers = buildSignatureHeaders(payloadStr, endpoint.secret)

  const start = Date.now()
  let responseStatus: number | null = null
  let responseBody: string | null = null

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: payloadStr,
      signal: AbortSignal.timeout(30000),
    })
    responseStatus = res.status
    responseBody = await res.text().catch(() => null)
    const durationMs = Date.now() - start

    await recordAttempt(delivery.id, delivery.attempt_count, responseStatus, responseBody, durationMs)
    const success = res.ok
    await updateDeliveryResult(delivery.id, responseStatus, responseBody, durationMs, success)

    if (!success) {
      const nextAttempt = delivery.attempt_count + 1
      if (nextAttempt <= MAX_ATTEMPTS) {
        const delayMs = RETRY_DELAYS_MS[nextAttempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
        const nextRetry = new Date(Date.now() + delayMs).toISOString()
        await supabase
          .from('webhook_deliveries')
          .update({
            attempt_count: nextAttempt,
            next_retry_at: nextRetry,
            response_status: responseStatus,
            response_body: responseBody,
            duration_ms: durationMs,
          })
          .eq('id', delivery.id)
      } else {
        // Final failure: mark terminally so processPendingDeliveries never picks this row again
        await supabase
          .from('webhook_deliveries')
          .update({
            next_retry_at: null,
            response_status: responseStatus,
            response_body: responseBody,
            duration_ms: durationMs,
          })
          .eq('id', delivery.id)
      }
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    responseBody = msg
    await recordAttempt(delivery.id, delivery.attempt_count, null, responseBody, durationMs)
    await updateDeliveryResult(delivery.id, null, responseBody, durationMs, false)
    const nextAttempt = delivery.attempt_count + 1
    if (nextAttempt <= MAX_ATTEMPTS) {
      const delayMs = RETRY_DELAYS_MS[nextAttempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
      const nextRetry = new Date(Date.now() + delayMs).toISOString()
      await supabase
        .from('webhook_deliveries')
        .update({
          attempt_count: nextAttempt,
          next_retry_at: nextRetry,
          response_body: responseBody,
          duration_ms: durationMs,
        })
        .eq('id', delivery.id)
    } else {
      // Final failure: mark terminally
      await supabase
        .from('webhook_deliveries')
        .update({
          next_retry_at: null,
          response_body: responseBody,
          duration_ms: durationMs,
        })
        .eq('id', delivery.id)
    }
    console.error('[WebhookDelivery] Send failed:', delivery.id, msg)
  }
}

async function updateDeliveryResult(
  deliveryId: string,
  responseStatus: number | null,
  responseBody: string | null,
  durationMs: number,
  success: boolean
): Promise<void> {
  await supabase
    .from('webhook_deliveries')
    .update({
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: durationMs,
      delivered_at: success ? new Date().toISOString() : null,
      next_retry_at: success ? null : undefined,
    })
    .eq('id', deliveryId)
}

/**
 * Check consecutive failures for an endpoint and alert if >= CONSECUTIVE_FAILURES_BEFORE_ALERT.
 * Sends email to org owners/admins and persists alert state to avoid spamming.
 */
async function maybeAlertAdmin(endpointId: string): Promise<void> {
  const { data: recent } = await supabase
    .from('webhook_deliveries')
    .select('id, delivered_at')
    .eq('endpoint_id', endpointId)
    .order('created_at', { ascending: false })
    .limit(CONSECUTIVE_FAILURES_BEFORE_ALERT)

  if (!recent || recent.length < CONSECUTIVE_FAILURES_BEFORE_ALERT) return
  const allFailed = recent.every((r: { delivered_at: string | null }) => !r.delivered_at)
  if (!allFailed) return

  const { data: endpoint, error: epError } = await supabase
    .from('webhook_endpoints')
    .select('id, organization_id, url')
    .eq('id', endpointId)
    .single()

  if (epError || !endpoint) return

  const { data: alertState } = await supabase
    .from('webhook_endpoint_alert_state')
    .select('last_alert_at')
    .eq('endpoint_id', endpointId)
    .maybeSingle()

  const lastAlertAt = alertState?.last_alert_at ? new Date(alertState.last_alert_at).getTime() : 0
  if (Date.now() - lastAlertAt < WEBHOOK_ALERT_COOLDOWN_MS) {
    return
  }

  const { data: admins } = await supabase
    .from('users')
    .select('id, email')
    .eq('organization_id', endpoint.organization_id)
    .in('role', ['owner', 'admin'])
    .not('email', 'is', null)

  const recipientEmails = (admins || []).map((a: { email: string }) => a.email).filter(Boolean)
  if (recipientEmails.length === 0) return

  const subject = 'Riskmate: Webhook delivery failures'
  const html = `
    <p>Your webhook endpoint has had ${CONSECUTIVE_FAILURES_BEFORE_ALERT} consecutive delivery failures.</p>
    <p><strong>Endpoint URL:</strong> ${endpoint.url || '(not set)'}</p>
    <p>Please check your endpoint URL, secret, and server logs. You can view delivery history and retry failed deliveries in Riskmate settings.</p>
  `

  try {
    await sendEmail({
      to: recipientEmails,
      subject,
      html,
    })
    const now = new Date().toISOString()
    await supabase.from('webhook_endpoint_alert_state').upsert(
      {
        endpoint_id: endpointId,
        last_alert_at: now,
        updated_at: now,
      },
      { onConflict: 'endpoint_id' }
    )
  } catch (err) {
    console.error('[WebhookDelivery] Admin alert email failed:', err)
  }
}

/**
 * Process pending deliveries: those with delivered_at IS NULL, next_retry_at <= now,
 * and attempt_count <= MAX_ATTEMPTS so the final (5th) scheduled attempt is processed; terminally failed have next_retry_at = null.
 */
async function processPendingDeliveries(): Promise<void> {
  const now = new Date().toISOString()
  const { data: pending, error } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .is('delivered_at', null)
    .not('next_retry_at', 'is', null)
    .lte('next_retry_at', now)
    .lte('attempt_count', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[WebhookDelivery] Fetch pending failed:', error)
    return
  }

  for (const row of pending || []) {
    const d = row as unknown as WebhookDeliveryRow
    await sendDelivery(d)
    if (d.attempt_count === MAX_ATTEMPTS) {
      await maybeAlertAdmin(d.endpoint_id)
    }
  }
}

let workerInterval: NodeJS.Timeout | null = null

export function startWebhookDeliveryWorker(): void {
  if (workerInterval) return
  const intervalMs = Math.max(2000, parseInt(process.env.WEBHOOK_WORKER_INTERVAL_MS || '5000', 10))
  workerInterval = setInterval(() => {
    processPendingDeliveries().catch((e) => console.error('[WebhookDelivery] Worker tick error:', e))
  }, intervalMs)
  processPendingDeliveries().catch((e) => console.error('[WebhookDelivery] Worker initial run:', e))
  console.log('[WebhookDelivery] Worker started, interval=%dms', intervalMs)
}

export function stopWebhookDeliveryWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
  }
}
