import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

/**
 * POST /api/incidents/corrective-action
 * Creates a corrective action (mitigation item) linked to an incident/work record
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
      console.error('[incidents/corrective-action] Auth error:', {
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
    
    // Authorization: Executives cannot create corrective actions
    if (user_role === 'executive') {
      const supabase = await createSupabaseServerClient()
      await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'auth.role_violation',
        targetType: 'system',
        metadata: {
          attempted_action: 'incident.corrective_action_created',
          policy_statement: 'Executives have read-only access',
          endpoint: '/api/incidents/corrective-action',
        },
      })
      
      const errorResponse = createErrorResponse(
        'Executives cannot create corrective actions',
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
      work_record_id, // Job ID
      incident_event_id, // Optional: related audit log event
      title,
      owner_id,
      due_date,
      verification_method = 'attestation',
      notes,
      severity // Optional: override severity
    } = body

    // Validation
    if (!work_record_id || !title || !owner_id || !due_date) {
      const errorResponse = createErrorResponse(
        'work_record_id, title, owner_id, and due_date are required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Hard rule: If high severity, require owner + due date (already validated above, but document it)
    // Note: severity validation would go here if severity field is provided

    const supabase = await createSupabaseServerClient()

    // Verify work record exists
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, client_name, organization_id')
      .eq('id', work_record_id)
      .eq('organization_id', organization_id)
      .single()

    if (!jobData) {
      const errorResponse = createErrorResponse(
        'Work record not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(errorResponse, { 
        status: 404,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Get owner info
    const { data: ownerData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', owner_id)
      .eq('organization_id', organization_id)
      .single()

    if (!ownerData) {
      const errorResponse = createErrorResponse(
        'Owner not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
      return NextResponse.json(errorResponse, { 
        status: 404,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Create mitigation item (control/corrective action)
    const { data: mitigationItem, error: mitigationError } = await supabase
      .from('mitigation_items')
      .insert({
        job_id: work_record_id,
        title,
        description: notes || title,
        owner_id,
        due_date,
        done: false,
        is_completed: false,
        verification_method,
        metadata: {
          incident_event_id: incident_event_id || null,
          severity: severity || null,
          created_as_corrective_action: true,
          created_at: new Date().toISOString(),
          created_by: user_id,
        },
      })
      .select()
      .single()

    if (mitigationError) {
      console.error('[incidents/corrective-action] Error creating mitigation:', {
        code: mitigationError.code,
        message: mitigationError.message,
        requestId,
      })
      const errorResponse = createErrorResponse(
        'Failed to create corrective action',
        'CREATE_ERROR',
        {
          requestId,
          statusCode: 500,
          details: {
            databaseError: {
              code: mitigationError.code,
              message: mitigationError.message,
            },
          },
        }
      )
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Write ledger entry
    const ledgerResult = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'incident.corrective_action_created',
      targetType: 'control',
      targetId: mitigationItem.id,
      metadata: {
        work_record_id,
        incident_event_id: incident_event_id || null,
        title,
        owner_id,
        owner_name: ownerData.full_name || ownerData.email,
        due_date,
        verification_method,
        notes: notes || null,
        severity: severity || null,
        created_at: new Date().toISOString(),
        summary: `Corrective action created: ${title}`,
      },
    })

    const successResponse = createSuccessResponse({
      id: mitigationItem.id,
      title: mitigationItem.title,
      owner_id: mitigationItem.owner_id,
      due_date: mitigationItem.due_date,
      ledger_entry_id: ledgerResult.data?.id,
    }, {
      message: 'Corrective action created successfully',
      requestId,
    })
    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId }
    })
  } catch (error: any) {
    console.error('[incidents/corrective-action] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    const errorResponse = createErrorResponse(
      error.message || 'Failed to create corrective action',
      error.code || 'CORRECTIVE_ACTION_ERROR',
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

