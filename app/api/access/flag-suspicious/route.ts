import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

/**
 * POST /api/access/flag-suspicious
 * Flags suspicious access event/user for investigation
 * Creates a review queue item for follow-up
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    let organization_id: string
    let user_id: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
      user_id = context.user_id
    } catch (authError: any) {
      console.error('[access/flag-suspicious] Auth error:', {
        message: authError.message,
        requestId,
      })
      const errorResponse = createErrorResponse(
        'Unauthorized: Please log in',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: { 'X-Request-ID': requestId }
      })
    }
    
    const body = await request.json()
    const { 
      event_id, // Optional: specific audit log event
      user_id: target_user_id, // Optional: user to flag
      severity = 'material', // 'critical' | 'material' | 'info'
      reason, // Required reason
      notes,
      assigned_to // Optional: assign to specific user for review
    } = body

    // Validation
    if (!event_id && !target_user_id) {
      const errorResponse = createErrorResponse(
        'Either event_id or user_id is required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    if (!reason || reason.trim().length < 3) {
      const errorResponse = createErrorResponse(
        'reason is required (minimum 3 characters)',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400, field: 'reason' }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    const supabase = await createSupabaseServerClient()

    let resolvedTargetUserId = target_user_id
    let targetId = event_id || resolvedTargetUserId
    let targetType: 'event' | 'user' = event_id ? 'event' : 'user'
    let targetName = 'Unknown'

    // Get target info
    if (event_id) {
      const { data: eventData } = await supabase
        .from('audit_logs')
        .select('id, event_name, actor_id, actor_email')
        .eq('id', event_id)
        .eq('organization_id', organization_id)
        .single()

      if (eventData) {
        targetName = eventData.event_name || 'Event'
        if (eventData.actor_id && !resolvedTargetUserId) {
          resolvedTargetUserId = eventData.actor_id
          targetId = resolvedTargetUserId
        }
      }
    } else if (resolvedTargetUserId) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('id', target_user_id)
        .eq('organization_id', organization_id)
        .single()

      if (userData) {
        targetName = userData.full_name || userData.email || 'User'
      }
    }

    // Update event metadata to mark as flagged
    if (event_id) {
      const { data: currentEvent } = await supabase
        .from('audit_logs')
        .select('metadata')
        .eq('id', event_id)
        .single()

      await supabase
        .from('audit_logs')
        .update({
          metadata: {
            ...(currentEvent?.metadata || {}),
            flagged_suspicious: {
              flagged_by: user_id,
              flagged_at: new Date().toISOString(),
              severity,
              reason: reason.trim(),
              notes: notes ? notes.trim() : null,
              assigned_to: assigned_to || null,
              status: 'under_review',
            },
          },
          severity: severity === 'critical' ? 'critical' : severity === 'material' ? 'material' : 'info',
        })
        .eq('id', event_id)
    }

    // Power move: Auto-create review queue item for follow-up
    // This creates a bridge between access review and review queue
    const reviewQueueEntry = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'review_queue.created_from_access',
      targetType: targetType,
      targetId: targetId,
      metadata: {
        source_event_id: event_id || null,
        source_type: 'access_flag',
        target_user_id: resolvedTargetUserId || null,
        severity,
        reason: reason.trim(),
        notes: notes ? notes.trim() : null,
        assigned_to: assigned_to || null,
        created_at: new Date().toISOString(),
        summary: `Review queue item created from suspicious access flag: ${reason.trim()}`,
        work_record_id: event_id ? (await supabase.from('audit_logs').select('work_record_id').eq('id', event_id).single()).data?.work_record_id : null,
      },
    })

    // Write ledger entry
    const ledgerResult = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'access.flagged_suspicious',
      targetType,
      targetId,
      metadata: {
        event_id: event_id || null,
        target_user_id: resolvedTargetUserId || null,
        severity,
        reason: reason.trim(),
        notes: notes ? notes.trim() : null,
        assigned_to: assigned_to || null,
        flagged_at: new Date().toISOString(),
        target_name: targetName,
        review_queue_entry_id: reviewQueueEntry.data?.id || null,
        summary: `Suspicious access flagged: ${reason.trim()}`,
      },
    })

    const successResponse = createSuccessResponse({
      ledger_entry_id: ledgerResult.data?.id,
      review_queue_entry_id: reviewQueueEntry.data?.id || null,
      incident_opened: severity === 'critical', // Indicate if this should open an incident
    }, {
      message: 'Suspicious access flagged successfully',
      requestId,
    })
    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId }
    })
  } catch (error: any) {
    console.error('[access/flag-suspicious] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    const errorResponse = createErrorResponse(
      error.message || 'Failed to flag suspicious access',
      error.code || 'FLAG_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
      }
    )
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: { 'X-Request-ID': requestId }
    })
  }
}

