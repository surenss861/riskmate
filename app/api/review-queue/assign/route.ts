import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse, MutationResponse } from '@/lib/utils/apiResponse'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * POST /api/review-queue/assign
 * Assigns review items (events/jobs) to a user with due date and priority
 * Supports bulk assignment via item_ids array
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    let organization_id: string
    let user_id: string
    let user_role: string
    try {
      const context = await getOrganizationContext()
      organization_id = context.organization_id
      user_id = context.user_id
      user_role = context.user_role
    } catch (authError: any) {
      console.error('[review-queue/assign] Auth error:', {
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
    
    // Authorization: Executives cannot assign
    if (user_role === 'executive') {
      const supabase = await createSupabaseServerClient()
      await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'auth.role_violation',
        targetType: 'system',
        metadata: {
          attempted_action: 'review_queue.assigned',
          policy_statement: 'Executives have read-only access and cannot assign review items',
          endpoint: '/api/review-queue/assign',
        },
      })
      
      const errorResponse = createErrorResponse(
        'Executives cannot assign review items',
        'AUTH_ROLE_READ_ONLY',
        { requestId, statusCode: 403 }
      )
      return NextResponse.json(errorResponse, { 
        status: 403,
        headers: { 'X-Request-ID': requestId }
      })
    }

    const body = await request.json()
    const { 
      item_ids, // Array of event IDs or job IDs
      assignee_id, 
      priority = 'medium', // 'low' | 'medium' | 'high'
      due_at, // ISO date string
      note 
    } = body

    // Validation
    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      const errorResponse = createErrorResponse(
        'item_ids array is required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    if (!assignee_id || !due_at) {
      const errorResponse = createErrorResponse(
        'assignee_id and due_at are required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    const supabase = await createSupabaseServerClient()

    // Get assignee info
    const { data: assigneeData } = await supabase
      .from('users')
      .select('full_name, email, role')
      .eq('id', assignee_id)
      .eq('organization_id', organization_id)
      .single()

    if (!assigneeData) {
      const errorResponse = createErrorResponse(
        'Assignee not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(errorResponse, { 
        status: 404,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Process each item (support bulk assignment)
    const ledgerEntryIds: string[] = []

    for (const itemId of item_ids) {
      // Determine target type by checking if it's a job or event
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, client_name, metadata')
        .eq('id', itemId)
        .eq('organization_id', organization_id)
        .single()

      let targetType: 'job' | 'event' = 'event'
      let targetName: string | null = null
      let isAlreadyResolved = false

      if (jobData) {
        targetType = 'job'
        targetName = jobData.client_name
        // Check if already resolved - can't assign resolved items
        isAlreadyResolved = jobData.metadata?.resolution?.status === 'resolved'
      } else {
        // Check if it's an audit log event
        const { data: eventData } = await supabase
          .from('audit_logs')
          .select('id, event_name, job_id, metadata')
          .eq('id', itemId)
          .eq('organization_id', organization_id)
          .single()

        if (!eventData) {
          console.warn(`[review-queue/assign] Item ${itemId} not found, skipping`, { requestId })
          continue
        }

        targetName = eventData.event_name || 'Event'
        // Check if already resolved - can't assign resolved items
        isAlreadyResolved = eventData.metadata?.resolution?.status === 'resolved'
      }

      // Hard rule: Can't assign resolved items
      if (isAlreadyResolved) {
        console.warn(`[review-queue/assign] Item ${itemId} is already resolved, skipping`, { requestId })
        continue
      }

      // Update the target record's metadata with assignment info
      if (targetType === 'job') {
        await supabase
          .from('jobs')
          .update({
            owner_id: assignee_id,
            due_date: due_at,
            review_flag: true,
            metadata: {
              assignment: {
                assigned_by: user_id,
                assigned_at: new Date().toISOString(),
                priority,
                note: note || null,
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
              assignment: {
                assignee_id,
                assignee_name: assigneeData.full_name || assigneeData.email,
                assigned_by: user_id,
                assigned_at: new Date().toISOString(),
                due_at,
                priority,
                note: note || null,
                status: 'assigned', // Status: open -> assigned
              },
            },
          })
          .eq('id', itemId)
      }

      // Write ledger entry
      const ledgerResult = await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'review_queue.assigned',
        targetType,
        targetId: itemId,
        metadata: {
          assignee_id,
          assignee_name: assigneeData.full_name || assigneeData.email,
          assignee_role: assigneeData.role,
          due_at,
          priority,
          note: note || null,
          assigned_at: new Date().toISOString(),
          target_name: targetName,
          summary: `Assigned to ${assigneeData.full_name || assigneeData.email} (due: ${due_at})`,
          work_record_id: targetType === 'job' ? itemId : undefined,
        },
      })

      if (ledgerResult.data?.id) {
        ledgerEntryIds.push(ledgerResult.data.id)
      }
    }

    // Update event name to match specification: review_queue.assigned
    const successResponse = createSuccessResponse({
      ledger_entry_ids: ledgerEntryIds,
      assigned_count: ledgerEntryIds.length,
    }, {
      message: `Successfully assigned ${ledgerEntryIds.length} item(s)`,
      requestId,
    })
    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId }
    })
  } catch (error: any) {
    console.error('[review-queue/assign] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    const errorResponse = createErrorResponse(
      error.message || 'Failed to assign review items',
      error.code || 'ASSIGN_ERROR',
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

