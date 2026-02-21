import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext, verifyOrganizationOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { mapTaskToApiShape } from '@/lib/utils/taskApiShape'

export const runtime = 'nodejs'

const ROUTE = '/api/tasks/[id]/complete'

async function createTaskCompletedNotificationRecord(
  userId: string,
  organizationId: string,
  taskId: string,
  taskTitle: string,
  jobTitle?: string | null
) {
  const admin = createSupabaseAdminClient()
  await admin.from('notifications').insert({
    user_id: userId,
    organization_id: organizationId,
    type: 'task_completed',
    content: `'${taskTitle}' has been completed`,
    is_read: false,
    deep_link: `riskmate://tasks/${taskId}`,
  })

  void jobTitle
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const { id: taskId } = await params

    await verifyOrganizationOwnership('tasks', taskId, organization_id)

    const supabase = await createSupabaseServerClient()

    const { data: existingTask, error: existingTaskError } = await supabase
      .from('tasks')
      .select('id, created_by, title, job_id')
      .eq('id', taskId)
      .eq('organization_id', organization_id)
      .single()

    if (existingTaskError || !existingTask) {
      throw existingTaskError || new Error('Task not found')
    }

    const nowIso = new Date().toISOString()
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        status: 'done',
        completed_at: nowIso,
        completed_by: user_id,
        updated_at: nowIso,
      })
      .eq('id', taskId)
      .eq('organization_id', organization_id)
      .select('*, assignee:assigned_to(id, full_name, email)')
      .single()

    if (updateError || !updatedTask) {
      throw updateError || new Error('Failed to complete task')
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('client_name')
      .eq('id', existingTask.job_id)
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (existingTask.created_by) {
      await createTaskCompletedNotificationRecord(
        existingTask.created_by,
        organization_id,
        taskId,
        existingTask.title,
        job?.client_name || 'Job'
      )
    }

    const data = mapTaskToApiShape(updatedTask)
    return NextResponse.json({ data })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to complete task',
      'QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal',
      severity: 'error',
      route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
    const { id: taskId } = await params

    await verifyOrganizationOwnership('tasks', taskId, organization_id)

    const nowIso = new Date().toISOString()
    const supabase = await createSupabaseServerClient()
    const { data: task, error } = await supabase
      .from('tasks')
      .update({
        status: 'todo',
        completed_at: null,
        completed_by: null,
        updated_at: nowIso,
      })
      .eq('id', taskId)
      .eq('organization_id', organization_id)
      .select('*, assignee:assigned_to(id, full_name, email)')
      .single()

    if (error || !task) {
      throw error || new Error('Failed to reopen task')
    }

    const data = mapTaskToApiShape(task)
    return NextResponse.json({ data })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to reopen task',
      'QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal',
      severity: 'error',
      route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}
