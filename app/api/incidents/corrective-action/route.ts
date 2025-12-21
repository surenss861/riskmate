import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'

export const runtime = 'nodejs'

/**
 * POST /api/incidents/corrective-action
 * Creates a corrective action (mitigation item) linked to an incident/work record
 */
export async function POST(request: NextRequest) {
  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext()
    
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
      
      return NextResponse.json(
        { ok: false, code: 'AUTH_ROLE_READ_ONLY', message: 'Executives cannot create corrective actions' },
        { status: 403 }
      )
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
      return NextResponse.json(
        { ok: false, message: 'work_record_id, title, owner_id, and due_date are required' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    // Verify work record exists
    const { data: jobData } = await supabase
      .from('jobs')
      .select('id, client_name, organization_id')
      .eq('id', work_record_id)
      .eq('organization_id', organization_id)
      .single()

    if (!jobData) {
      return NextResponse.json(
        { ok: false, message: 'Work record not found' },
        { status: 404 }
      )
    }

    // Get owner info
    const { data: ownerData } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', owner_id)
      .eq('organization_id', organization_id)
      .single()

    if (!ownerData) {
      return NextResponse.json(
        { ok: false, message: 'Owner not found' },
        { status: 404 }
      )
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
      console.error('[incidents/corrective-action] Error creating mitigation:', mitigationError)
      return NextResponse.json(
        { ok: false, message: 'Failed to create corrective action', code: 'CREATE_ERROR' },
        { status: 500 }
      )
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

    return NextResponse.json({
      ok: true,
      message: 'Corrective action created successfully',
      data: {
        id: mitigationItem.id,
        title: mitigationItem.title,
        owner_id: mitigationItem.owner_id,
        due_date: mitigationItem.due_date,
      },
      ledger_entry_id: ledgerResult.data?.id,
    })
  } catch (error: any) {
    console.error('[incidents/corrective-action] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to create corrective action',
        code: 'CORRECTIVE_ACTION_ERROR',
      },
      { status: 500 }
    )
  }
}

