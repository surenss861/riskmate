/**
 * Webhook delivery: enqueue deliveries for events, send with HMAC signature, retry with backoff.
 * Retry: 5min → 30min → 2hr → 24hr → fail. Alert org admin after 5 consecutive failures.
 */

import crypto from 'crypto'
import { supabase } from '../lib/supabaseClient'
import { buildSignatureHeaders } from '../utils/webhookSigning'
import { validateWebhookUrl } from '../utils/webhookUrl'
import { sendEmail } from '../utils/email'
import { buildWebhookEventObject } from '../utils/webhookPayloads'

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
/** Claims older than this are considered stale (worker crashed); recovery will clear them so the row can be reclaimed. */
const STALE_CLAIM_MS = 10 * 60 * 1000 // 10 min
/** Max number of sendDelivery() calls in flight at once; avoids one slow endpoint blocking the queue. */
const DELIVERY_CONCURRENCY = Math.max(1, Math.min(10, parseInt(process.env.WEBHOOK_DELIVERY_CONCURRENCY || '5', 10)))

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
  processing_since: string | null
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
  const normalized = buildWebhookEventObject(eventType, data)
  const payload = buildWebhookPayload(eventType, orgId, normalized)

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

  if (filtered.length === 0) return

  const nextRetryAt = new Date().toISOString()
  const rows = filtered.map((ep: WebhookEndpointRow) => ({
    endpoint_id: ep.id,
    event_type: eventType,
    payload: payload as unknown as Record<string, unknown>,
    attempt_count: 1,
    next_retry_at: nextRetryAt,
  }))

  const { error: insertError } = await supabase.from('webhook_deliveries').insert(rows)
  if (insertError) {
    console.error('[WebhookDelivery] Batched insert deliveries failed:', insertError)
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
 * If the endpoint is inactive (paused), does not send; terminalizes the delivery with a clear message.
 */
export async function sendDelivery(delivery: WebhookDeliveryRow): Promise<void> {
  const { data: endpoint, error: epError } = await supabase
    .from('webhook_endpoints')
    .select('url, secret, is_active')
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
        processing_since: null,
      })
      .eq('id', delivery.id)
    return
  }

  if (endpoint.is_active === false) {
    const msg = 'Endpoint is paused; delivery cancelled'
    console.log('[WebhookDelivery] Endpoint paused, cancelling delivery:', delivery.id, delivery.endpoint_id)
    await recordAttempt(delivery.id, delivery.attempt_count, null, msg, 0)
    await supabase
      .from('webhook_deliveries')
      .update({
        response_status: null,
        response_body: msg,
        duration_ms: 0,
        next_retry_at: null,
        processing_since: null,
      })
      .eq('id', delivery.id)
    return
  }

  const urlCheck = await validateWebhookUrl(endpoint.url)
  if (!urlCheck.valid) {
    const forceTerminal = urlCheck.terminal // only true for explicit policy (SSRF/blocked); DNS/transient → retry
    console.error(
      '[WebhookDelivery]',
      forceTerminal ? 'Blocked unsafe URL' : 'URL validation failed (transient)',
      delivery.endpoint_id,
      urlCheck.reason
    )
    await recordAttempt(delivery.id, delivery.attempt_count, null, `Blocked: ${urlCheck.reason}`, 0)
    await updateDeliveryFailure(
      delivery.id,
      delivery.endpoint_id,
      null,
      `Blocked: ${urlCheck.reason}`,
      0,
      delivery.attempt_count,
      forceTerminal,
    )
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
      redirect: 'manual',
    })
    responseStatus = res.status
    responseBody = await res.text().catch(() => null)
    const durationMs = Date.now() - start

    await recordAttempt(delivery.id, delivery.attempt_count, responseStatus, responseBody, durationMs)
    const success = res.ok
    if (success) {
      await updateDeliveryResult(delivery.id, responseStatus, responseBody, durationMs)
    } else {
      await updateDeliveryFailure(
        delivery.id,
        delivery.endpoint_id,
        responseStatus,
        responseBody,
        durationMs,
        delivery.attempt_count,
      )
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    responseBody = msg
    await recordAttempt(delivery.id, delivery.attempt_count, null, responseBody, durationMs)
    await updateDeliveryFailure(
      delivery.id,
      delivery.endpoint_id,
      null,
      responseBody,
      durationMs,
      delivery.attempt_count,
    )
    console.error('[WebhookDelivery] Send failed:', delivery.id, msg)
  }
}

/** Success: single atomic update — response fields, delivered_at, clear retry and claim. */
async function updateDeliveryResult(
  deliveryId: string,
  responseStatus: number | null,
  responseBody: string | null,
  durationMs: number,
): Promise<void> {
  await supabase
    .from('webhook_deliveries')
    .update({
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: durationMs,
      delivered_at: new Date().toISOString(),
      next_retry_at: null,
      processing_since: null,
    })
    .eq('id', deliveryId)
}

/**
 * Failure: single atomic update — response fields, attempt_count, next_retry_at, and claim release.
 * No intermediate write that clears processing_since alone, avoiding duplicate claims and resends.
 * When forceTerminal is true (e.g. blocked URL), no retries are scheduled.
 */
async function updateDeliveryFailure(
  deliveryId: string,
  endpointId: string,
  responseStatus: number | null,
  responseBody: string | null,
  durationMs: number,
  currentAttemptCount: number,
  forceTerminal = false,
): Promise<void> {
  const nextAttempt = currentAttemptCount + 1
  const terminal = forceTerminal || nextAttempt > MAX_ATTEMPTS
  const nextRetryAt = terminal
    ? null
    : new Date(
        Date.now() + (RETRY_DELAYS_MS[nextAttempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]),
      ).toISOString()

  await supabase
    .from('webhook_deliveries')
    .update({
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: durationMs,
      delivered_at: null,
      attempt_count: nextAttempt,
      next_retry_at: nextRetryAt,
      processing_since: null,
    })
    .eq('id', deliveryId)

  // Alert only when retry exhaustion reaches the configured threshold (5 consecutive failures).
  // Do not alert for forceTerminal paths (e.g. blocked URL) to avoid false "5 consecutive failures" emails.
  if (terminal && nextAttempt > MAX_ATTEMPTS) {
    await maybeAlertAdmin(endpointId)
  }
}

/**
 * Alert org admins when a delivery has reached terminal failure (exhausted all retries).
 * Called only when a delivery has just failed its fifth attempt. Cooldown prevents spamming.
 */
async function maybeAlertAdmin(endpointId: string): Promise<void> {
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
 * Atomically claim a pending delivery row so only one worker tick processes it.
 * Returns the updated row if claimed, null if already claimed or delivered.
 */
async function claimDelivery(id: string): Promise<WebhookDeliveryRow | null> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('webhook_deliveries')
    .update({ processing_since: now })
    .eq('id', id)
    .is('delivered_at', null)
    .is('processing_since', null)
    .select('*')
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as WebhookDeliveryRow
}

/**
 * Reset stale claims so rows stuck after a worker crash can be picked again.
 * Idempotent: only clears processing_since when it is older than STALE_CLAIM_MS; actively processing rows are untouched.
 */
async function recoverStaleClaims(): Promise<void> {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString()
  const { error } = await supabase
    .from('webhook_deliveries')
    .update({ processing_since: null })
    .is('delivered_at', null)
    .not('processing_since', 'is', null)
    .lt('processing_since', staleBefore)
  if (error) {
    console.error('[WebhookDelivery] Stale claim recovery failed:', error)
  }
}

/**
 * Run async tasks with bounded concurrency. Used so one slow endpoint does not block others.
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0
  const worker = async (): Promise<void> => {
    while (true) {
      const i = index++
      if (i >= items.length) return
      await fn(items[i])
    }
  }
  const workers = Math.min(concurrency, items.length)
  if (workers <= 0) return
  await Promise.all(Array.from({ length: workers }, () => worker()))
}

/**
 * Process pending deliveries: those with delivered_at IS NULL, next_retry_at <= now,
 * and attempt_count <= MAX_ATTEMPTS so the final (5th) scheduled attempt is processed; terminally failed have next_retry_at = null.
 * Claims rows first (one-by-one to preserve claim semantics), then dispatches sendDelivery() with bounded concurrency so one slow
 * endpoint does not block others. Stale-claim recovery runs first so rows stuck after a worker crash become reclaimable.
 */
let processPendingDeliveriesRunning = false

async function processPendingDeliveries(): Promise<void> {
  if (processPendingDeliveriesRunning) return
  processPendingDeliveriesRunning = true
  try {
    await recoverStaleClaims()
    const now = new Date().toISOString()
    const { data: pending, error } = await supabase
      .from('webhook_deliveries')
      .select('id')
      .is('delivered_at', null)
      .is('processing_since', null)
      .not('next_retry_at', 'is', null)
      .lte('next_retry_at', now)
      .lte('attempt_count', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('[WebhookDelivery] Fetch pending failed:', error)
      return
    }

    const claimed: WebhookDeliveryRow[] = []
    for (const row of pending || []) {
      const c = await claimDelivery(row.id)
      if (c) claimed.push(c)
    }
    await runWithConcurrency(claimed, DELIVERY_CONCURRENCY, sendDelivery)
  } finally {
    processPendingDeliveriesRunning = false
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
