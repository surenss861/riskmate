/**
 * Trigger webhook event from Next.js: enqueue one delivery per active endpoint.
 * Backend worker processes webhook_deliveries and sends with HMAC.
 *
 * Webhook emission paths: Next.js API routes call triggerWebhookEvent; Express backend routes call deliverEvent.
 * These are mutually exclusive per request — a given client request is handled by one stack only (e.g. browser → Next.js, mobile → Express).
 * Do not fire webhooks from both when one stack proxies to the other; centralize in the stack that performs the mutation.
 */

import crypto from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { buildWebhookEventObject } from '@/lib/webhooks/payloads'
import { WEBHOOK_EVENT_TYPES } from '@/lib/webhooks/eventTypes'

export type { WebhookEventType } from '@/lib/webhooks/eventTypes'

function buildPayload(
  eventType: string,
  organizationId: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    id: `evt_${crypto.randomUUID()}`,
    type: eventType,
    created: new Date().toISOString(),
    organization_id: organizationId,
    data: { object: data },
  }
}

/**
 * Enqueue webhook deliveries for the given event. One row per active endpoint subscribed to the event.
 * Backend worker will pick these up and send.
 * Uses canonical payload schema per event type so consumers get a stable contract.
 */
export async function triggerWebhookEvent(
  organizationId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!(WEBHOOK_EVENT_TYPES as readonly string[]).includes(eventType)) {
    throw new Error(`Invalid webhook event type: ${eventType}. Must be one of: ${WEBHOOK_EVENT_TYPES.join(', ')}`)
  }
  const supabase = createSupabaseAdminClient()
  const normalized = buildWebhookEventObject(eventType, data)
  const payload = buildPayload(eventType, organizationId, normalized)

  const { data: endpoints, error: fetchError } = await supabase
    .from('webhook_endpoints')
    .select('id, events')
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  if (fetchError) {
    console.error('[WebhookTrigger] Fetch endpoints failed:', fetchError)
    throw new Error('Webhook endpoints fetch failed: ' + fetchError.message)
  }

  const filtered = (endpoints || []).filter(
    (e: { id: string; events: string[] }) => e.events && Array.isArray(e.events) && e.events.includes(eventType)
  )

  if (filtered.length === 0) return

  const nextRetryAt = new Date().toISOString()
  const rows = filtered.map((ep: { id: string }) => ({
    endpoint_id: ep.id,
    event_type: eventType,
    payload,
    attempt_count: 1,
    next_retry_at: nextRetryAt,
  }))

  const { error: insertError } = await supabase.from('webhook_deliveries').insert(rows)
  if (insertError) {
    console.error('[WebhookTrigger] Batched insert deliveries failed:', insertError)
    throw new Error(`Webhook delivery enqueue failed: ${insertError.message}`)
  }
  wakeBackendWebhookWorker().catch((err: unknown) => {
    console.warn('[WebhookTrigger] Wake worker call failed (delivery will be picked up on next poll):', err instanceof Error ? err.message : err)
  })
}

// One-time warning when wake is skipped due to missing env (avoid log spam on every trigger).
let _wakeEnvWarned = false
function warnWakeEnvOnce(): void {
  if (_wakeEnvWarned) return
  _wakeEnvWarned = true
  const url = process.env.BACKEND_URL
  const secret = process.env.INTERNAL_API_KEY
  if (!url || !secret) {
    console.warn(
      '[WebhookTrigger] BACKEND_URL and INTERNAL_API_KEY are not set; worker wake-up is skipped. Deliveries will be processed on the next poll interval (~2s). Set these env vars for sub-second webhook delivery SLA.'
    )
  }
}

/**
 * Notify backend to run the delivery worker immediately so enqueued deliveries are processed
 * within SLA. Fire-and-forget; requires BACKEND_URL and INTERNAL_API_KEY to be set.
 * Exported for use by manual webhook flows (test, retry) that enqueue deliveries without going through triggerWebhookEvent.
 */
export function wakeBackendWebhookWorker(): Promise<void> {
  const url = process.env.BACKEND_URL
  const secret = process.env.INTERNAL_API_KEY
  if (!url || !secret) {
    warnWakeEnvOnce()
    return Promise.resolve()
  }
  const endpoint = `${url.replace(/\/$/, '')}/api/internal/wake-webhook-worker`
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': secret },
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Wake worker failed: ${response.status} ${text}`)
    }
    return undefined
  })
}
