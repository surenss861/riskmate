import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

/**
 * POST /api/incidents/close
 * Closes an incident with closure summary and verification
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
      console.error('[incidents/close] Auth error:', {
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
    
    // Authorization: Executives cannot close incidents
    if (user_role === 'executive') {
      const supabase = await createSupabaseServerClient()
      await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'auth.role_violation',
        targetType: 'system',
        metadata: {
          attempted_action: 'incident.closed',
          policy_statement: 'Executives have read-only access',
          endpoint: '/api/incidents/close',
        },
      })
      
      const errorResponse = createErrorResponse(
        'Executives cannot close incidents',
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
      work_record_id, // Job ID (the incident)
      closure_summary,
      root_cause,
      evidence_attached = false,
      waived = false,
      waiver_reason,
      no_action_required = false,
      no_action_justification,
      require_attestation = true
    } = body

    // Validation
    if (!work_record_id || !closure_summary) {
      const errorResponse = createErrorResponse(
        'work_record_id and closure_summary are required',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Guardrails
    if (no_action_required && !no_action_justification) {
      const errorResponse = createErrorResponse(
        'no_action_justification is required when no_action_required is true',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400, field: 'no_action_justification' }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    if (waived && !waiver_reason) {
      const errorResponse = createErrorResponse(
        'waiver_reason is required when waived is true',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400, field: 'waiver_reason' }
      )
      return NextResponse.json(errorResponse, { 
        status: 400,
        headers: { 'X-Request-ID': requestId }
      })
    }

    const supabase = await createSupabaseServerClient()

    // Verify work record exists
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, client_name, organization_id, status')
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

    // Hard rule: Can't close if there are open corrective actions unless user provides override
    if (!no_action_required) {
      const { data: openActions, count: openActionsCount } = await supabase
        .from('mitigation_items')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', work_record_id)
        .eq('is_completed', false)
        .eq('done', false)

      if (openActionsCount && openActionsCount > 0 && !no_action_justification) {
        const errorResponse = createErrorResponse(
          `Cannot close incident: ${openActionsCount} open corrective action(s) remain. Provide justification or mark as no_action_required.`,
          'VALIDATION_ERROR',
          { 
            requestId, 
            statusCode: 400,
            details: { open_actions_count: openActionsCount },
          }
        )
        return NextResponse.json(errorResponse, { 
          status: 400,
          headers: { 'X-Request-ID': requestId }
        })
      }
    }

    // Get actor info
    const { data: actorData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', user_id)
      .single()

    // Update work record to mark incident as closed
    await supabase
      .from('jobs')
      .update({
        status: 'completed',
        review_flag: false, // Clear review flag
        metadata: {
          incident_closed: {
            closed_by: user_id,
            closed_at: new Date().toISOString(),
            closure_summary,
            root_cause,
            evidence_attached,
            waived,
            waiver_reason: waiver_reason || null,
            no_action_required,
            no_action_justification: no_action_justification || null,
          },
        },
      })
      .eq('id', work_record_id)

    // Optionally create attestation if required
    let attestationId: string | null = null
    if (require_attestation) {
      const { data: attestation } = await supabase
        .from('job_signoffs')
        .insert({
          job_id: work_record_id,
          user_id,
          signoff_type: 'incident_closure',
          signed_at: new Date().toISOString(),
          metadata: {
            closure_summary,
            root_cause,
          },
        })
        .select('id')
        .single()

      attestationId = attestation?.id || null
    }

    // Write ledger entry
    const ledgerResult = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'incident.closed',
      targetType: 'job',
      targetId: work_record_id,
      metadata: {
        work_record_id,
        closure_summary,
        root_cause,
        evidence_attached,
        waived,
        waiver_reason: waiver_reason || null,
        no_action_required,
        no_action_justification: no_action_justification || null,
        attestation_id: attestationId,
        closed_at: new Date().toISOString(),
        closed_by: user_id,
        closed_by_name: actorData?.full_name || actorData?.email || 'Unknown',
        summary: `Incident closed: ${closure_summary}`,
      },
    })

    const successResponse = createSuccessResponse({
      work_record_id,
      attestation_id: attestationId,
      ledger_entry_id: ledgerResult.data?.id,
    }, {
      message: 'Incident closed successfully',
      requestId,
    })
    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId }
    })
  } catch (error: any) {
    console.error('[incidents/close] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    const errorResponse = createErrorResponse(
      error.message || 'Failed to close incident',
      error.code || 'CLOSE_INCIDENT_ERROR',
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

