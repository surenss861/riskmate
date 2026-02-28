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

export const WEBHOOK_EVENT_TYPES = [
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

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]

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
    return
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
}
