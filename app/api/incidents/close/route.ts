import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'

export const runtime = 'nodejs'

/**
 * POST /api/incidents/close
 * Closes an incident with closure summary and verification
 */
export async function POST(request: NextRequest) {
  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext()
    
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
      
      return NextResponse.json(
        { ok: false, code: 'AUTH_ROLE_READ_ONLY', message: 'Executives cannot close incidents' },
        { status: 403 }
      )
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
      return NextResponse.json(
        { ok: false, message: 'work_record_id and closure_summary are required' },
        { status: 400 }
      )
    }

    // Guardrails
    if (no_action_required && !no_action_justification) {
      return NextResponse.json(
        { ok: false, message: 'no_action_justification is required when no_action_required is true' },
        { status: 400 }
      )
    }

    if (waived && !waiver_reason) {
      return NextResponse.json(
        { ok: false, message: 'waiver_reason is required when waived is true' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { ok: false, message: 'Work record not found' },
        { status: 404 }
      )
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

    return NextResponse.json({
      ok: true,
      message: 'Incident closed successfully',
      data: {
        work_record_id,
        attestation_id: attestationId,
      },
      ledger_entry_id: ledgerResult.data?.id,
    })
  } catch (error: any) {
    console.error('[incidents/close] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to close incident',
        code: 'CLOSE_INCIDENT_ERROR',
      },
      { status: 500 }
    )
  }
}

