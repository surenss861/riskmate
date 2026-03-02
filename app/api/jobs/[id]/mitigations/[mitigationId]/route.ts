import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { triggerWebhookEvent } from '@/lib/webhooks/trigger'

export const runtime = 'nodejs'

/**
 * Webhook ownership: This Next.js route owns hazard.updated emission for web-client mitigation
 * updates. The Express route at apps/backend/src/routes/jobs.ts (PATCH /:id/mitigations/:mitigationId)
 * owns emission for mobile/direct API clients. The two paths are mutually exclusive — do not proxy
 * mitigation PATCH to Express for the same request to avoid duplicate deliveries.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mitigationId: string }> }
) {
  try {
    // Get organization context (throws if unauthorized)
    const { organization_id, user_id } = await getOrganizationContext()
    const { id: jobId, mitigationId } = await params
    const body = await request.json()
    const { done } = body

    if (typeof done !== 'boolean') {
      return NextResponse.json(
        { message: "'done' boolean field is required" },
        { status: 400 }
      )
    }

    // Verify job ownership (defense-in-depth)
    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()
    const userId = user_id

    // Update mitigation item
    const updatePayload = {
      done,
      is_completed: done,
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? userId : null,
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('mitigation_items')
      .update(updatePayload)
      .eq('id', mitigationId)
      .eq('job_id', jobId)
      .select('id, title, description, done, is_completed, completed_at, created_at, hazard_id')
      .maybeSingle()

    if (updateError) {
      if ((updateError as any).code === 'PGRST116') {
        return NextResponse.json(
          { message: 'Mitigation item not found' },
          { status: 404 }
        )
      }
      throw updateError
    }

    if (!updatedItem) {
      return NextResponse.json(
        { message: 'Mitigation item not found' },
        { status: 404 }
      )
    }

    // Fire hazard.updated only when the toggled item is itself a hazard (hazard_id IS NULL).
    // Control completions (items with a non-null hazard_id) are excluded: we do not emit
    // hazard.updated for the parent hazard when a control is toggled, to avoid ambiguity
    // about which entity changed and to keep the webhook payload aligned with the updated row.
    // Enqueue failures are not retried; monitor [WebhookTrigger] Fetch endpoints failed.
    if ((updatedItem as { hazard_id?: string | null }).hazard_id == null) {
      await triggerWebhookEvent(organization_id, 'hazard.updated', {
        id: updatedItem.id,
        job_id: jobId,
        title: updatedItem.title ?? '',
        description: updatedItem.description ?? '',
        done: updatedItem.done,
        is_completed: updatedItem.is_completed,
        completed_at: updatedItem.completed_at,
        created_at: updatedItem.created_at,
      }).catch((e) => console.warn('[Webhook] hazard.updated trigger failed:', e))
    }

    return NextResponse.json({ data: updatedItem })
  } catch (error: any) {
    console.error('Mitigation update failed:', error)
    return NextResponse.json(
      { message: 'Failed to update mitigation item' },
      { status: 500 }
    )
  }
}

