/**
 * Webhook delivery: enqueue deliveries for events, send with HMAC signature, retry with backoff.
 * Retry: 5min → 30min → 2hr → 24hr → fail. Alert org admin when a single delivery exhausts its retry attempts (with cooldown).
 * Secrets are read from webhook_endpoint_secrets (service-role only). Rotate SUPABASE_SERVICE_ROLE_KEY
 * regularly and restrict/audit service-role access.
 */

import crypto from 'crypto'
import { supabase } from '../lib/supabaseClient'
import { buildSignatureHeaders } from '../utils/webhookSigning'
import { decryptWebhookSecret, validateWebhookSecretEncryptionKey } from '../utils/secretEncryption'
import { validateWebhookUrl } from '../utils/webhookUrl'
import { sendEmail } from '../utils/email'
import { buildWebhookEventObject } from '../utils/webhookPayloads'

/** Delays after attempt N before attempt N+1: 1→2: 5min, 2→3: 30min, 3→4: 2hr, 4→5: 24hr. Index = nextAttempt - 2; guard for nextAttempt < 2 = immediate. */
const RETRY_DELAYS_AFTER_ATTEMPT_MS = [
  5 * 60 * 1000,        // after attempt 1 → wait 5 min
  30 * 60 * 1000,        // after attempt 2 → 30 min
  2 * 60 * 60 * 1000,    // after attempt 3 → 2 hr
  24 * 60 * 60 * 1000,   // after attempt 4 → 24 hr
]

const MAX_ATTEMPTS = 5
const WEBHOOK_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24h dedupe
/** Debounce delay for wake-up: coalesce rapid enqueues into one immediate run. */
const WAKE_DEBOUNCE_MS = 100
/** Claims older than this are considered stale (worker crashed); recovery will clear them so the row can be reclaimed. */
const STALE_CLAIM_MS = 10 * 60 * 1000 // 10 min

/**
 * Parse an env value as a finite integer within [min, max]; invalid or out-of-range yields default.
 * Prevents NaN from non-numeric env (e.g. WEBHOOK_DELIVERY_CONCURRENCY=foo) from creating zero workers
 * or WEBHOOK_WORKER_INTERVAL_MS from becoming 0ms and causing tight-loop polling.
 */
export function parseSafeBoundedInt(
  envValue: string | undefined,
  defaultVal: number,
  min: number,
  max: number
): number {
  const n = parseInt(envValue ?? '', 10)
  if (!Number.isFinite(n)) return defaultVal
  return Math.max(min, Math.min(max, Math.floor(n)))
}

/** Max number of sendDelivery() calls in flight at once; avoids one slow endpoint blocking the queue. */
const DELIVERY_CONCURRENCY = parseSafeBoundedInt(
  process.env.WEBHOOK_DELIVERY_CONCURRENCY,
  5,
  1,
  10
)

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

/** Escape HTML special characters to prevent injection when interpolating into HTML (e.g. admin alert email). */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strict allowlist for internal emit endpoint; do not accept arbitrary event_type from callers. */
export const ALLOWED_WEBHOOK_EVENT_TYPES: readonly WebhookEventType[] = [
  'job.created',
  'job.updated',
  'job.completed',
  'job.deleted',
  'hazard.created',
  'hazard.updated',
  'signature.added',
  'report.generated',
  'evidence.uploaded',
  'team.member_added',
] as const

/**
 * Validate payload shape for internal emit. Ensures data is a non-null object and has required fields per event type.
 */
export function validateWebhookEmitPayload(
  eventType: string,
  data: unknown
): { valid: true } | { valid: false; message: string } {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, message: 'data must be a non-null object' }
  }
  const obj = data as Record<string, unknown>
  switch (eventType) {
    case 'job.created':
    case 'job.updated':
    case 'job.completed':
    case 'job.deleted':
    case 'hazard.created':
    case 'hazard.updated':
      if (typeof obj.id !== 'string') {
        return { valid: false, message: `${eventType} requires data.id (string)` }
      }
      break
    case 'signature.added':
      if (typeof (obj.signoff_id ?? obj.id) !== 'string') {
        return { valid: false, message: 'signature.added requires data.signoff_id or data.id' }
      }
      break
    case 'report.generated':
      if (typeof (obj.report_run_id ?? obj.id) !== 'string') {
        return { valid: false, message: 'report.generated requires data.report_run_id or data.id' }
      }
      break
    case 'evidence.uploaded':
      if (typeof (obj.id ?? obj.document_id) !== 'string') {
        return { valid: false, message: 'evidence.uploaded requires data.id or data.document_id' }
      }
      break
    case 'team.member_added':
      if (typeof (obj.user_id ?? obj.id) !== 'string') {
        return { valid: false, message: 'team.member_added requires data.user_id or data.id' }
      }
      break
    default:
      return { valid: false, message: `unknown event_type: ${eventType}` }
  }
  return { valid: true }
}

export interface WebhookEventPayload {
  id: string
  type: string
  created: string
  organization_id: string
  data: Record<string, unknown>
}

/** Endpoint list row without secret (e.g. deliverEvent only needs id, events, is_active). */
interface WebhookEndpointListRow {
  id: string
  organization_id: string
  url: string
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
 * Used by Express backend only. Next.js uses triggerWebhookEvent (lib/webhooks/trigger.ts). Do not call both for the same logical operation — each request path must emit from one stack only to avoid duplicate deliveries.
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
    .select('id, organization_id, url, events, is_active')
    .eq('organization_id', orgId)
    .eq('is_active', true)

  if (fetchError) {
    console.error('[WebhookDelivery] Fetch endpoints failed:', fetchError)
    throw new Error(`Webhook endpoints fetch failed: ${fetchError.message}`)
  }

  const filtered = (endpoints || []).filter(
    (e: WebhookEndpointListRow) => e.events && e.events.includes(eventType)
  )

  if (filtered.length === 0) return

  const nextRetryAt = new Date().toISOString()
  const rows = filtered.map((ep: WebhookEndpointListRow) => ({
    endpoint_id: ep.id,
    event_type: eventType,
    payload: payload as unknown as Record<string, unknown>,
    attempt_count: 1,
    next_retry_at: nextRetryAt,
  }))

  const { error: insertError } = await supabase.from('webhook_deliveries').insert(rows)
  if (insertError) {
    console.error('[WebhookDelivery] Batched insert deliveries failed:', insertError)
    throw new Error(`Webhook deliveries insert failed: ${insertError.message}`)
  }
  wakeWebhookWorker()
}

/**
 * Record one send attempt in webhook_delivery_attempts for immutable per-attempt history.
 * Uses upsert so re-runs (e.g. after stale-claim recovery) are idempotent.
 * Returns true if the write succeeded; false on error (logs with delivery/attempt context).
 * Callers must treat false as a first-class error and not report the delivery as successful.
 */
async function recordAttempt(
  deliveryId: string,
  attemptNumber: number,
  responseStatus: number | null,
  responseBody: string | null,
  durationMs: number
): Promise<boolean> {
  const { error } = await supabase.from('webhook_delivery_attempts').upsert(
    {
      delivery_id: deliveryId,
      attempt_number: attemptNumber,
      response_status: responseStatus,
      response_body: responseBody,
      duration_ms: durationMs,
    },
    {
      onConflict: 'delivery_id,attempt_number',
    }
  )
  if (error) {
    console.error(
      '[WebhookDelivery] Attempt persistence failed',
      { deliveryId, attemptNumber, error: error.message, code: error.code }
    )
    return false
  }
  return true
}

/**
 * Send one delivery: POST to endpoint URL with signed payload, update row, record attempt.
 * If the endpoint is inactive (paused), does not send; terminalizes the delivery with a clear message.
 */
export async function sendDelivery(delivery: WebhookDeliveryRow): Promise<void> {
  const { data: endpoint, error: epError } = await supabase
    .from('webhook_endpoints')
    .select('url, is_active')
    .eq('id', delivery.endpoint_id)
    .single()

  const { data: secretRow, error: secretError } = await supabase
    .from('webhook_endpoint_secrets')
    .select('secret')
    .eq('endpoint_id', delivery.endpoint_id)
    .maybeSingle()

  const rawSecret = secretRow?.secret ?? null
  let secret: string | null = null
  if (rawSecret != null) {
    try {
      const keyHex = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY
      secret = decryptWebhookSecret(rawSecret, keyHex)
    } catch (decryptErr) {
      const reason = decryptErr instanceof Error ? decryptErr.message : 'Webhook secret decryption failed (invalid or missing WEBHOOK_SECRET_ENCRYPTION_KEY)'
      console.error('[WebhookDelivery]', reason, delivery.endpoint_id)
      const attemptOk = await recordAttempt(delivery.id, delivery.attempt_count, null, reason, 0)
      if (!attemptOk) {
        await markDeliveryAttemptPersistenceFailed(delivery.id)
        return
      }
      await supabase
        .from('webhook_deliveries')
        .update({
          response_status: null,
          response_body: reason,
          duration_ms: 0,
          next_retry_at: null,
          processing_since: null,
          terminal_outcome: 'failed',
        })
        .eq('id', delivery.id)
      return
    }
  }
  const endpointWithSecret = endpoint ? { ...endpoint, secret } : null

  // Query failures (endpoint or secret fetch error) → retryable. Permanent states → terminal.
  if (epError) {
    const isEndpointMissing = epError.code === 'PGRST116'
    const reason = isEndpointMissing
      ? 'Endpoint not found (deleted)'
      : `Endpoint fetch failed (transient): ${epError.message}`
    console.error('[WebhookDelivery]', reason, delivery.endpoint_id)
    const attemptOk = await recordAttempt(delivery.id, delivery.attempt_count, null, reason, 0)
    if (!attemptOk) {
      await markDeliveryAttemptPersistenceFailed(delivery.id)
      return
    }
    if (isEndpointMissing) {
      await supabase
        .from('webhook_deliveries')
        .update({
          response_status: null,
          response_body: reason,
          duration_ms: 0,
          next_retry_at: null,
          processing_since: null,
          terminal_outcome: 'failed',
        })
        .eq('id', delivery.id)
    } else {
      await updateDeliveryFailure(
        delivery.id,
        delivery.endpoint_id,
        null,
        reason,
        0,
        delivery.attempt_count,
        false,
        'failed',
        false, // do not count infrastructure transient errors toward consecutive_failures
      )
    }
    return
  }

  if (secretError) {
    const reason = `Secret fetch failed (transient): ${secretError.message}`
    console.error('[WebhookDelivery]', reason, delivery.endpoint_id)
    const attemptOk = await recordAttempt(delivery.id, delivery.attempt_count, null, reason, 0)
    if (!attemptOk) {
      await markDeliveryAttemptPersistenceFailed(delivery.id)
      return
    }
    await updateDeliveryFailure(
      delivery.id,
      delivery.endpoint_id,
      null,
      reason,
      0,
      delivery.attempt_count,
      false,
      'failed',
      false, // do not count infrastructure transient errors toward consecutive_failures
    )
    return
  }

  if (!endpoint || !endpointWithSecret || !secret) {
    // TOCTOU: endpoint may have been deleted between endpoint fetch and secret fetch; re-check to avoid misleading "no secret" message.
    let reason = 'Endpoint has no secret'
    if (endpoint && !secret && !secretError) {
      const { data: recheckEp } = await supabase
        .from('webhook_endpoints')
        .select('id')
        .eq('id', delivery.endpoint_id)
        .maybeSingle()
      if (!recheckEp) reason = 'Endpoint not found (deleted)'
    }
    console.error('[WebhookDelivery]', reason, delivery.endpoint_id)
    const attemptOk = await recordAttempt(delivery.id, delivery.attempt_count, null, reason, 0)
    if (!attemptOk) {
      await markDeliveryAttemptPersistenceFailed(delivery.id)
      return
    }
    await supabase
      .from('webhook_deliveries')
      .update({
        response_status: null,
        response_body: reason,
        duration_ms: 0,
        next_retry_at: null,
        processing_since: null,
        terminal_outcome: 'failed',
      })
      .eq('id', delivery.id)
    return
  }

  if (endpointWithSecret.is_active === false) {
    const msg = 'Endpoint is paused; delivery cancelled'
    console.log('[WebhookDelivery] Endpoint paused, cancelling delivery:', delivery.id, delivery.endpoint_id)
    const attemptOk = await recordAttempt(delivery.id, delivery.attempt_count, null, msg, 0)
    if (!attemptOk) {
      await markDeliveryAttemptPersistenceFailed(delivery.id)
      return
    }
    await supabase
      .from('webhook_deliveries')
      .update({
        response_status: null,
        response_body: msg,
        duration_ms: 0,
        next_retry_at: null,
        processing_since: null,
        terminal_outcome: 'cancelled_paused',
      })
      .eq('id', delivery.id)
    return
  }

  const urlCheck = await validateWebhookUrl(endpointWithSecret.url)
  if (!urlCheck.valid) {
    const forceTerminal = urlCheck.terminal // only true for explicit policy (SSRF/blocked) or invalid URL shape; DNS/transient → retry
    console.error(
      '[WebhookDelivery]',
      forceTerminal ? 'Blocked unsafe URL' : 'URL validation failed (transient)',
      delivery.endpoint_id,
      urlCheck.reason
    )
    const attemptOk = await recordAttempt(delivery.id, delivery.attempt_count, null, `Blocked: ${urlCheck.reason}`, 0)
    if (!attemptOk) {
      await markDeliveryAttemptPersistenceFailed(delivery.id)
      return
    }
    await updateDeliveryFailure(
      delivery.id,
      delivery.endpoint_id,
      null,
      `Blocked: ${urlCheck.reason}`,
      0,
      delivery.attempt_count,
      forceTerminal,
      forceTerminal ? 'cancelled_policy' : 'failed',
      forceTerminal ? false : true, // do not count policy-cancelled toward consecutive_failures or admin alerts
    )
    return
  }

  const payloadStr = JSON.stringify(delivery.payload)
  const headers = buildSignatureHeaders(payloadStr, secret)

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

    const attemptOk = await recordAttempt(delivery.id, delivery.attempt_count, responseStatus, responseBody, durationMs)
    if (!attemptOk) {
      await markDeliveryAttemptPersistenceFailed(delivery.id)
      return
    }
    const success = res.ok
    if (success) {
      await updateDeliveryResult(delivery.id, delivery.endpoint_id, responseStatus, responseBody, durationMs)
    } else {
      await updateDeliveryFailure(
        delivery.id,
        delivery.endpoint_id,
        responseStatus,
        responseBody,
        durationMs,
        delivery.attempt_count,
        false,
        'failed',
      )
    }
  } catch (err: unknown) {
    const durationMs = Date.now() - start
    const msg = err instanceof Error ? err.message : String(err)
    responseBody = msg
    const attemptOk = await recordAttempt(delivery.id, delivery.attempt_count, null, responseBody, durationMs)
    if (!attemptOk) {
      await markDeliveryAttemptPersistenceFailed(delivery.id)
      return
    }
    await updateDeliveryFailure(
      delivery.id,
      delivery.endpoint_id,
      null,
      responseBody,
      durationMs,
      delivery.attempt_count,
      false,
      'failed',
    )
    console.error('[WebhookDelivery] Send failed:', delivery.id, msg)
  }
}

/** Mark delivery as terminally failed because attempt log could not be persisted; do not report as success. */
async function markDeliveryAttemptPersistenceFailed(deliveryId: string): Promise<void> {
  await supabase
    .from('webhook_deliveries')
    .update({
      response_status: null,
      response_body: 'Attempt persistence failed; delivery history may be incomplete',
      duration_ms: null,
      next_retry_at: null,
      processing_since: null,
      terminal_outcome: 'failed',
    })
    .eq('id', deliveryId)
}

/** Success: single atomic update — response fields, delivered_at, clear retry and claim; reset consecutive_failures for endpoint. */
async function updateDeliveryResult(
  deliveryId: string,
  endpointId: string,
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
      terminal_outcome: 'delivered',
    })
    .eq('id', deliveryId)

  const now = new Date().toISOString()
  await supabase.from('webhook_endpoint_alert_state').upsert(
    { endpoint_id: endpointId, consecutive_failures: 0, updated_at: now },
    { onConflict: 'endpoint_id' }
  )
}

/**
 * Failure: single atomic update — response fields, attempt_count, next_retry_at, and claim release.
 * No intermediate write that clears processing_since alone, avoiding duplicate claims and resends.
 * When forceTerminal is true (e.g. blocked URL), no retries are scheduled.
 * terminalOutcomeReason: 'failed' for retry exhaustion or missing endpoint; 'cancelled_policy' for policy blocks (e.g. blocked URL).
 * countAsConsecutiveFailure: when false (e.g. secret fetch or endpoint fetch transient errors), do not increment consecutive_failures so infrastructure blips do not trigger admin alerts.
 * attempt_count: when terminal (including retry exhaustion), we persist the attempt just executed (currentAttemptCount), not nextAttempt, so it never exceeds MAX_ATTEMPTS.
 */
async function updateDeliveryFailure(
  deliveryId: string,
  endpointId: string,
  responseStatus: number | null,
  responseBody: string | null,
  durationMs: number,
  currentAttemptCount: number,
  forceTerminal = false,
  terminalOutcomeReason: 'failed' | 'cancelled_policy' = 'failed',
  countAsConsecutiveFailure = true,
): Promise<void> {
  const nextAttempt = currentAttemptCount + 1
  const terminal = forceTerminal || nextAttempt > MAX_ATTEMPTS
  const delayMs =
    nextAttempt < 2
      ? 0
      : (RETRY_DELAYS_AFTER_ATTEMPT_MS[nextAttempt - 2] ?? RETRY_DELAYS_AFTER_ATTEMPT_MS[RETRY_DELAYS_AFTER_ATTEMPT_MS.length - 1])
  const nextRetryAt = terminal ? null : new Date(Date.now() + delayMs).toISOString()
  const attemptCountToPersist = terminal ? currentAttemptCount : nextAttempt

  const updatePayload: Record<string, unknown> = {
    response_status: responseStatus,
    response_body: responseBody,
    duration_ms: durationMs,
    delivered_at: null,
    attempt_count: attemptCountToPersist,
    next_retry_at: nextRetryAt,
    processing_since: null,
  }
  if (terminal) {
    updatePayload.terminal_outcome = terminalOutcomeReason
  }

  await supabase
    .from('webhook_deliveries')
    .update(updatePayload)
    .eq('id', deliveryId)

  // On terminal failure (e.g. retry exhaustion after attempt 5), increment consecutive_failures and alert admin only when count reaches threshold (e.g. 5).
  if (terminal && countAsConsecutiveFailure) {
    const { data: newCount } = await supabase.rpc('increment_webhook_endpoint_consecutive_failures', {
      p_endpoint_id: endpointId,
    })
    if (newCount != null && newCount >= 5) {
      await maybeAlertAdmin(endpointId)
    }
  }
}

/**
 * Alert org admins when a delivery has exhausted retries for this endpoint.
 * Cooldown prevents spamming; only one alert per endpoint per WEBHOOK_ALERT_COOLDOWN_MS.
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

  // Cooldown: skip if we sent an alert recently for this endpoint.
  if (alertState?.last_alert_at != null) {
    const lastAlertAt = new Date(alertState.last_alert_at).getTime()
    if (Date.now() - lastAlertAt < WEBHOOK_ALERT_COOLDOWN_MS) {
      return
    }
  }

  // Include admins/owners from users.organization_id and from organization_members (multi-org).
  const recipientEmails = new Set<string>()

  const { data: usersAsAdmins } = await supabase
    .from('users')
    .select('id, email')
    .eq('organization_id', endpoint.organization_id)
    .in('role', ['owner', 'admin'])
    .not('email', 'is', null)
  for (const u of usersAsAdmins ?? []) {
    if (u.email) recipientEmails.add(u.email)
  }

  const { data: orgMemberAdmins } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', endpoint.organization_id)
    .in('role', ['owner', 'admin'])
  const memberUserIds = (orgMemberAdmins ?? []).map((m: { user_id: string }) => m.user_id).filter(Boolean)
  if (memberUserIds.length > 0) {
    const { data: memberUsers } = await supabase
      .from('users')
      .select('email')
      .in('id', memberUserIds)
      .not('email', 'is', null)
    for (const u of memberUsers ?? []) {
      if (u.email) recipientEmails.add(u.email)
    }
  }

  const toList = Array.from(recipientEmails)
  if (toList.length === 0) return

  const subject = 'Riskmate: Webhook delivery failed after retries'
  const html = `
    <p>A webhook delivery has failed after exhausting all ${MAX_ATTEMPTS} retry attempts.</p>
    <p><strong>Endpoint URL:</strong> ${escapeHtml(endpoint.url || '(not set)')}</p>
    <p>Please check your endpoint URL, secret, and server logs. You can view delivery history and retry failed deliveries in Riskmate settings.</p>
  `

  try {
    await sendEmail({
      to: toList,
      subject,
      html,
    })
    const now = new Date().toISOString()
    await supabase.from('webhook_endpoint_alert_state').upsert(
      {
        endpoint_id: endpointId,
        last_alert_at: now,
        updated_at: now,
        consecutive_failures: 0,
      },
      { onConflict: 'endpoint_id' }
    )
  } catch (err) {
    console.error('[WebhookDelivery] Admin alert email failed:', err)
  }
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
    .is('terminal_outcome', null)
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
/** Set when wake/timer fires during an active run; triggers an immediate claim cycle after current batch completes so new rows are not delayed by long send timeouts. */
let pendingRunRequested = false

async function processPendingDeliveries(): Promise<void> {
  if (processPendingDeliveriesRunning) {
    pendingRunRequested = true
    return
  }
  processPendingDeliveriesRunning = true
  try {
    await recoverStaleClaims()
    const { data: claimed, error } = await supabase.rpc('claim_pending_webhook_deliveries', { p_limit: 50 })
    if (error) {
      console.error('[WebhookDelivery] Atomic claim failed:', error)
      return
    }
    const rows = (claimed ?? []) as WebhookDeliveryRow[]
    await runWithConcurrency(rows, DELIVERY_CONCURRENCY, sendDelivery)
  } finally {
    processPendingDeliveriesRunning = false
    if (pendingRunRequested) {
      pendingRunRequested = false
      setImmediate(() => processPendingDeliveries().catch((e) => console.error('[WebhookDelivery] Rerun after batch error:', e)))
    }
  }
}

let workerInterval: NodeJS.Timeout | null = null
let wakeDebounceTimer: NodeJS.Timeout | null = null

/**
 * Schedule an immediate, debounced run of the delivery worker so fresh enqueues are processed
 * without waiting for the next interval tick. Safe to call from both deliverEvent() and from
 * the internal wake endpoint (Next.js trigger path). Reuses processPendingDeliveriesRunning guard.
 */
export function wakeWebhookWorker(): void {
  if (wakeDebounceTimer) clearTimeout(wakeDebounceTimer)
  wakeDebounceTimer = setTimeout(() => {
    wakeDebounceTimer = null
    processPendingDeliveries().catch((e) => console.error('[WebhookDelivery] Wake run error:', e))
  }, WAKE_DEBOUNCE_MS)
}

/**
 * In-memory guard (processPendingDeliveriesRunning) is process-local only. Cross-instance safety relies on
 * claim_pending_webhook_deliveries RPC's FOR UPDATE SKIP LOCKED — multiple worker instances may run; each claims rows atomically.
 */
export async function startWebhookDeliveryWorker(): Promise<void> {
  if (workerInterval) return
  // Backend supabase client must use SUPABASE_SERVICE_ROLE_KEY so webhook_endpoint_secrets (service-role only) is readable
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!key) {
    console.error('[WebhookDelivery] SUPABASE_SERVICE_ROLE_KEY is missing; secret fetch will fail')
  } else {
    console.log('[WebhookDelivery] Supabase client: service role (secrets accessible)')
  }
  const keyValidation = validateWebhookSecretEncryptionKey(process.env.WEBHOOK_SECRET_ENCRYPTION_KEY)
  if (!keyValidation.valid) {
    const { data: rows } = await supabase.from('webhook_endpoint_secrets').select('secret').limit(100)
    const hasEncrypted = (rows ?? []).some((r: { secret?: string }) => (r.secret ?? '').startsWith('v1:'))
    if (hasEncrypted) {
      throw new Error(
        'WEBHOOK_SECRET_ENCRYPTION_KEY is missing or invalid but at least one endpoint has an encrypted (v1:) secret. Set the key and restart the worker.'
      )
    }
    console.error('[WebhookDelivery]', keyValidation.message, '- encrypted webhook secrets will fail to decrypt; ensure web and backend use the same key')
  }
  if (!(process.env.INTERNAL_API_KEY ?? '').trim()) {
    console.warn('[WebhookDelivery] INTERNAL_API_KEY is not set; Next.js cannot wake this worker after enqueue. Deliveries will still be processed on the next poll interval.')
  }
  // Default 2s gives headroom below 5s SLA; periodic poll remains as fallback
  const intervalMs = parseSafeBoundedInt(
    process.env.WEBHOOK_WORKER_INTERVAL_MS,
    2000,
    2000,
    24 * 60 * 60 * 1000
  )
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
  processPendingDeliveriesRunning = false
  pendingRunRequested = false
}
