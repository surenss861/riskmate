import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * POST /api/review-queue/assign
 * Assigns review items (events/jobs) to a user with due date and priority
 * Supports bulk assignment via item_ids array
 */
export async function POST(request: NextRequest) {
  try {
    const { organization_id, user_id, user_role } = await getOrganizationContext()
    
    // Authorization: Executives cannot assign
    if (user_role === 'executive') {
      const supabase = await createSupabaseServerClient()
      await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'auth.role_violation',
        targetType: 'system',
        metadata: {
          attempted_action: 'review.assigned',
          policy_statement: 'Executives have read-only access and cannot assign review items',
          endpoint: '/api/review-queue/assign',
        },
      })
      
      return NextResponse.json(
        { 
          ok: false,
          code: 'AUTH_ROLE_READ_ONLY',
          message: 'Executives cannot assign review items' 
        },
        { status: 403 }
      )
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
      return NextResponse.json(
        { ok: false, message: 'item_ids array is required' },
        { status: 400 }
      )
    }

    if (!assignee_id || !due_at) {
      return NextResponse.json(
        { ok: false, message: 'assignee_id and due_at are required' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { ok: false, message: 'Assignee not found' },
        { status: 404 }
      )
    }

    // Process each item (support bulk assignment)
    const ledgerEntryIds: string[] = []

    for (const itemId of item_ids) {
      // Determine target type by checking if it's a job or event
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
        // Check if it's an audit log event
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
                status: 'assigned',
              },
            },
          })
          .eq('id', itemId)
      }

      // Write ledger entry
      const ledgerResult = await recordAuditLog(supabase, {
        organizationId: organization_id,
        actorId: user_id,
        eventName: 'review.assigned',
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

    return NextResponse.json({
      ok: true,
      message: `Successfully assigned ${ledgerEntryIds.length} item(s)`,
      ledger_entry_ids: ledgerEntryIds,
      assigned_count: ledgerEntryIds.length,
    })
  } catch (error: any) {
    console.error('[review-queue/assign] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        message: error.message || 'Failed to assign review items',
        code: 'ASSIGN_ERROR',
      },
      { status: 500 }
    )
  }
}

