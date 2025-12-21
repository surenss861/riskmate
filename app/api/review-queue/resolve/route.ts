import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'

export const runtime = 'nodejs'

/**
 * POST /api/review-queue/resolve
 * Resolves review items with a resolution type and notes
 * Supports bulk resolution via item_ids array
 */
export async function POST(request: NextRequest) {
  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext()
    
    // Authorization: Executives cannot resolve (read-only)
    if (user_role === 'executive') {
      const supabase = await createSupabaseServerClient()
      await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'auth.role_violation',
        targetType: 'system',
        metadata: {
          attempted_action: 'review.resolved',
          policy_statement: 'Executives have read-only access and cannot resolve review items',
          endpoint: '/api/review-queue/resolve',
        },
      })
      
      return NextResponse.json(
        { 
          ok: false,
          code: 'AUTH_ROLE_READ_ONLY',
          message: 'Executives cannot resolve review items' 
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { 
      item_ids, // Array of event IDs or job IDs
      resolution, // 'false_positive' | 'mitigated' | 'accepted_risk' | 'duplicate' | 'completed'
      notes,
      waived = false,
      waiver_reason
    } = body

    // Validation
    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { ok: false, message: 'item_ids array is required' },
        { status: 400 }
      )
    }

    if (!resolution) {
      return NextResponse.json(
        { ok: false, message: 'resolution is required' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    // Get actor info
    const { data: actorData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', user_id)
      .single()

    const ledgerEntryIds: string[] = []

    // Process each item
    for (const itemId of item_ids) {
      // Determine target type
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, client_name')
        .eq('id', itemId)
        .eq('organization_id', organization_id)
        .single()

      let targetType: 'job' | 'event' = 'event'
      let targetName: string | null = null

      if (jobData) {
        targetType = 'job'
        targetName = jobData.client_name
      } else {
        const { data: eventData } = await supabase
          .from('audit_logs')
          .select('id, event_name, job_id')
          .eq('id', itemId)
          .eq('organization_id', organization_id)
          .single()

        if (!eventData) {
          console.warn(`Item ${itemId} not found, skipping`)
          continue
        }

        targetName = eventData.event_name || 'Event'
      }

      // Update target record metadata
      if (targetType === 'job') {
        await supabase
          .from('jobs')
          .update({
            review_flag: false, // Clear review flag
            metadata: {
              resolution: {
                resolved_by: user_id,
                resolved_at: new Date().toISOString(),
                resolution,
                notes: notes || null,
                waived,
                waiver_reason: waiver_reason || null,
                status: 'resolved',
              },
            },
          })
          .eq('id', itemId)
      } else {
        // Update audit log metadata
        const { data: currentEvent } = await supabase
          .from('audit_logs')
          .select('metadata')
          .eq('id', itemId)
          .single()

        await supabase
          .from('audit_logs')
          .update({
            metadata: {
              ...(currentEvent?.metadata || {}),
              resolution: {
                resolved_by: user_id,
                resolved_at: new Date().toISOString(),
                resolution,
                notes: notes || null,
                waived,
                waiver_reason: waiver_reason || null,
                status: 'resolved',
              },
            },
          })
          .eq('id', itemId)
      }

      // Write ledger entry
      const ledgerResult = await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: waived ? 'review.waived' : 'review.resolved',
        targetType,
        targetId: itemId,
        metadata: {
          resolution,
          notes: notes || null,
          waived,
          waiver_reason: waiver_reason || null,
          resolved_at: new Date().toISOString(),
          resolved_by: user_id,
          resolved_by_name: actorData?.full_name || actorData?.email || 'Unknown',
          target_name: targetName,
          summary: `Resolved as: ${resolution}${waived ? ' (waived)' : ''}`,
          work_record_id: targetType === 'job' ? itemId : undefined,
        },
      })

      if (ledgerResult.data?.id) {
        ledgerEntryIds.push(ledgerResult.data.id)
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully resolved ${ledgerEntryIds.length} item(s)`,
      ledger_entry_ids: ledgerEntryIds,
      resolved_count: ledgerEntryIds.length,
    })
  } catch (error: any) {
    console.error('[review-queue/resolve] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to resolve review items',
        code: 'RESOLVE_ERROR',
      },
      { status: 500 }
    )
  }
}

