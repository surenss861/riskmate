/**
 * Trigger webhook event from Next.js: enqueue one delivery per active endpoint.
 * Backend worker processes webhook_deliveries and sends with HMAC.
 */

import crypto from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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
 */
export async function triggerWebhookEvent(
  organizationId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseAdminClient()
  const payload = buildPayload(eventType, organizationId, data)

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
  }
}
