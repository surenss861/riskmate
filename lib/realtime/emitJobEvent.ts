/**
 * Emit a job event to realtime_events for client refresh signals.
 * Uses admin client to bypass RLS. Non-blocking; logs and continues on failure.
 */

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type JobEventType = 'job.created' | 'job.updated' | 'job.archived' | 'job.deleted' | 'job.flagged'

export async function emitJobEvent(
  organizationId: string,
  eventType: JobEventType,
  jobId: string,
  actorId?: string | null
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient()
    const payload = { job_id: jobId }
    const { error } = await supabase.from('realtime_events').insert({
      organization_id: organizationId,
      event_type: eventType,
      entity_type: 'job',
      entity_id: jobId,
      payload,
      created_by: actorId ?? null,
    })
    if (error) {
      console.warn('[emitJobEvent] Insert failed:', eventType, jobId, error.message)
    }
  } catch (err: any) {
    console.warn('[emitJobEvent] Exception:', err?.message)
  }
}
