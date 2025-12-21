import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

/**
 * POST /api/review-queue/resolve
 * Resolves review items with a resolution type and notes
 * Supports bulk resolution via item_ids array
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
      console.error('[review-queue/resolve] Auth error:', {
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
    
    // Authorization: Executives cannot resolve (read-only)
    if (user_role === 'executive') {
      const supabase = await createSupabaseServerClient()
      await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'auth.role_violation',
        targetType: 'system',
        metadata: {
          attempted_action: 'review_queue.resolved',
          policy_statement: 'Executives have read-only access and cannot resolve review items',
          endpoint: '/api/review-queue/resolve',
        },
      })
      
      const errorResponse = createErrorResponse(
        'Executives cannot resolve review items',
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
      resolution, // 'remediated' | 'accepted_risk' | 'false_positive' | 'waived'
      notes,
      waived = false,
      waiver_reason,
      expires_at // Required if waived
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

    if (!resolution) {
      const errorResponse = createErrorResponse(
        'resolution is required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Hard rules: Must require notes for audit defensibility
    if (!notes || notes.trim().length < 3) {
      const errorResponse = createErrorResponse(
        'notes are required (minimum 3 characters) for audit defensibility',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400, field: 'notes' }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Hard rules: If waived, must include expires_at
    if (waived && !expires_at) {
      const errorResponse = createErrorResponse(
        'expires_at is required when waived is true',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400, field: 'expires_at' }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
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
        // Check if already resolved
        isAlreadyResolved = jobData.metadata?.resolution?.status === 'resolved' || !jobData.metadata?.review_flag
      } else {
        const { data: eventData } = await supabase
          .from('audit_logs')
          .select('id, event_name, job_id, metadata')
          .eq('id', itemId)
          .eq('organization_id', organization_id)
          .single()

        if (!eventData) {
          console.warn(`[review-queue/resolve] Item ${itemId} not found, skipping`, { requestId })
          continue
        }

        targetName = eventData.event_name || 'Event'
        // Check if already resolved
        isAlreadyResolved = eventData.metadata?.resolution?.status === 'resolved' || eventData.metadata?.assignment?.status === 'resolved'
      }

      // Hard rule: Can't resolve already resolved items
      if (isAlreadyResolved) {
        console.warn(`[review-queue/resolve] Item ${itemId} is already resolved, skipping`, { requestId })
        continue
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
              notes: notes.trim(),
              waived,
              waiver_reason: waived ? (waiver_reason || null) : null,
              expires_at: waived ? expires_at : null,
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
        eventName: waived ? 'review_queue.waived' : 'review_queue.resolved',
        targetType,
        targetId: itemId,
        metadata: {
          resolution,
          notes: notes.trim(),
          waived,
          waiver_reason: waived ? (waiver_reason || null) : null,
          expires_at: waived ? expires_at : null,
          resolved_at: new Date().toISOString(),
          resolved_by: user_id,
          resolved_by_name: actorData?.full_name || actorData?.email || 'Unknown',
          target_name: targetName,
          summary: `Resolved as: ${resolution}${waived ? ` (waived, expires: ${expires_at})` : ''}`,
          work_record_id: targetType === 'job' ? itemId : undefined,
        },
      })

      if (ledgerResult.data?.id) {
        ledgerEntryIds.push(ledgerResult.data.id)
      }
    }

    const successResponse = createSuccessResponse({
      ledger_entry_ids: ledgerEntryIds,
      resolved_count: ledgerEntryIds.length,
    }, {
      message: `Successfully resolved ${ledgerEntryIds.length} item(s)`,
      requestId,
    })
    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId }
    })
  } catch (error: any) {
    console.error('[review-queue/resolve] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    const errorResponse = createErrorResponse(
      error.message || 'Failed to resolve review items',
      error.code || 'RESOLVE_ERROR',
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

