import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'

export const runtime = 'nodejs'

/**
 * POST /api/access/flag-suspicious
 * Flags suspicious access event/user for investigation
 * Creates a review queue item for follow-up
 */
export async function POST(request: NextRequest) {
  try {
    const { organization_id, user_id } = await getOrganizationContext()
    
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
      return NextResponse.json(
        { ok: false, message: 'Either event_id or user_id is required' },
        { status: 400 }
      )
    }

    if (!reason) {
      return NextResponse.json(
        { ok: false, message: 'reason is required' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()

    let targetId = event_id || target_user_id
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
        if (eventData.actor_id && !target_user_id) {
          target_user_id = eventData.actor_id
        }
      }
    } else if (target_user_id) {
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

    // Optionally create/update a review queue entry by updating the event metadata
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
              reason,
              notes: notes || null,
              assigned_to: assigned_to || null,
              status: 'under_review',
            },
          },
          severity: severity === 'critical' ? 'critical' : severity === 'material' ? 'material' : 'info',
        })
        .eq('id', event_id)
    }

    // Write ledger entry
    const ledgerResult = await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'access.flagged_suspicious',
      targetType,
      targetId,
      metadata: {
        event_id: event_id || null,
        target_user_id: target_user_id || null,
        severity,
        reason,
        notes: notes || null,
        assigned_to: assigned_to || null,
        flagged_at: new Date().toISOString(),
        target_name: targetName,
        summary: `Suspicious access flagged: ${reason}`,
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Suspicious access flagged successfully',
      ledger_entry_id: ledgerResult.data?.id,
      incident_opened: severity === 'critical', // Indicate if this should open an incident
    })
  } catch (error: any) {
    console.error('[access/flag-suspicious] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to flag suspicious access',
        code: 'FLAG_ERROR',
      },
      { status: 500 }
    )
  }
}

