import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext, verifyOrganizationOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { mapTaskToApiShape } from '@/lib/utils/taskApiShape'
import { getSessionToken, BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const ROUTE = '/api/tasks/[id]'

const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
    const { id: taskId } = await params

    await verifyOrganizationOwnership('tasks', taskId, organization_id)

    const supabase = await createSupabaseServerClient()
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*, assignee:assigned_to(id, full_name, email)')
      .eq('id', taskId)
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!task) {
      const { response, errorId } = createErrorResponse('Task not found', 'NOT_FOUND', {
        requestId,
        statusCode: 404,
      })
      logApiError(404, 'NOT_FOUND', errorId, requestId, organization_id, response.message, {
        category: 'validation',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const data = mapTaskToApiShape(task)
    return NextResponse.json({ data })
  } catch (error: any) {
    const msg = error?.message || 'Failed to get task'
    const isNotFound = typeof msg === 'string' && msg.includes('Resource not found')
    const isForbidden = typeof msg === 'string' && msg.includes('Access denied')
    const statusCode = isNotFound ? 404 : isForbidden ? 403 : 500
    const code = isNotFound ? 'NOT_FOUND' : isForbidden ? 'FORBIDDEN' : 'QUERY_ERROR'
    const { response, errorId } = createErrorResponse(msg, code, {
      requestId,
      statusCode,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    logApiError(statusCode, code, errorId, requestId, undefined, response.message, {
      category: isNotFound || isForbidden ? 'auth' : 'internal',
      severity: statusCode >= 500 ? 'error' : 'warn',
      route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: statusCode,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const { id: taskId } = await params

    await verifyOrganizationOwnership('tasks', taskId, organization_id)

    const body = await request.json()
    const { title, description, assigned_to, priority, due_date, status, sort_order } = body

    if (priority !== undefined && (typeof priority !== 'string' || !(TASK_PRIORITIES as readonly string[]).includes(priority))) {
      const { response, errorId } = createErrorResponse(
        'priority must be one of: low, medium, high, urgent',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'VALIDATION_ERROR', errorId, requestId, organization_id, response.message, {
        category: 'validation',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (status !== undefined && (typeof status !== 'string' || !(TASK_STATUSES as readonly string[]).includes(status))) {
      const { response, errorId } = createErrorResponse(
        'status must be one of: todo, in_progress, done, cancelled',
        'VALIDATION_ERROR',
        { requestId, statusCode: 400 }
      )
      logApiError(400, 'VALIDATION_ERROR', errorId, requestId, organization_id, response.message, {
        category: 'validation',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 400,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (assigned_to !== undefined && assigned_to != null) {
      const admin = createSupabaseAdminClient()
      const { data: userInOrg } = await admin
        .from('users')
        .select('id')
        .eq('id', assigned_to)
        .eq('organization_id', organization_id)
        .maybeSingle()
      if (!userInOrg) {
        const { response, errorId } = createErrorResponse(
          'assigned_to must be a user in your organization',
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'VALIDATION_ERROR', errorId, requestId, organization_id, response.message, {
          category: 'validation',
          severity: 'warn',
          route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
    }

    if (title !== undefined) {
      const trimmed = typeof title === 'string' ? title.trim() : ''
      if (!trimmed) {
        const { response, errorId } = createErrorResponse(
          'title cannot be empty or whitespace',
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'VALIDATION_ERROR', errorId, requestId, organization_id, response.message, {
          category: 'validation',
          severity: 'warn',
          route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = typeof title === 'string' ? title.trim() : title
    if (description !== undefined) updateData.description = description
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to
    if (priority !== undefined) updateData.priority = priority
    if (due_date !== undefined) updateData.due_date = due_date
    if (status !== undefined) {
      updateData.status = status
      if (status === 'done') {
        updateData.completed_at = new Date().toISOString()
        updateData.completed_by = user_id
      } else {
        updateData.completed_at = null
        updateData.completed_by = null
      }
    }
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const supabase = await createSupabaseServerClient()

    let existingTask: { status: string; created_by: string | null; title: string; job_id: string; assigned_to: string | null } | null = null
    if (status === 'done' || assigned_to !== undefined) {
      const { data: existing } = await supabase
        .from('tasks')
        .select('status, created_by, title, job_id, assigned_to')
        .eq('id', taskId)
        .eq('organization_id', organization_id)
        .single()
      existingTask = existing ?? null
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('organization_id', organization_id)
      .select('*, assignee:assigned_to(id, full_name, email)')
      .single()

    if (error || !task) {
      throw error || new Error('Failed to update task')
    }

    if (status === 'done' && existingTask?.status !== 'done' && existingTask?.created_by && BACKEND_URL) {
      const token = await getSessionToken(request)
      if (token) {
        const { data: job } = await supabase
          .from('jobs')
          .select('client_name')
          .eq('id', existingTask.job_id)
          .eq('organization_id', organization_id)
          .maybeSingle()
        fetch(`${BACKEND_URL}/api/notifications/task-completed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: existingTask.created_by,
            taskId,
            taskTitle: existingTask.title,
            jobTitle: job?.client_name || 'Job',
          }),
        }).catch((err) => {
          console.warn('[Tasks] Task completed notification (push/email) failed:', err)
        })
      }
    }

    const previousAssignee = existingTask?.assigned_to ?? null
    const newAssignee = assigned_to !== undefined ? assigned_to : previousAssignee
    if (
      assigned_to !== undefined &&
      newAssignee != null &&
      String(previousAssignee) !== String(newAssignee) &&
      BACKEND_URL
    ) {
      const token = await getSessionToken(request)
      if (token) {
        const { data: job } = await supabase
          .from('jobs')
          .select('client_name')
          .eq('id', task.job_id)
          .eq('organization_id', organization_id)
          .maybeSingle()
        const jobTitle = job?.client_name || 'Job'
        fetch(`${BACKEND_URL}/api/notifications/task-assigned`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: newAssignee,
            taskId,
            taskTitle: task.title,
            jobId: task.job_id,
            jobTitle,
          }),
        }).catch((err) => {
          console.warn('[Tasks] Task assigned notification (push/email) failed:', err)
        })
      }
    }

    const data = mapTaskToApiShape(task)
    return NextResponse.json({ data })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to update task',
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

    const supabase = await createSupabaseServerClient()
    const { data: deleted, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('organization_id', organization_id)
      .select('id')

    if (error) {
      throw error
    }

    if (!deleted || deleted.length === 0) {
      const { response, errorId } = createErrorResponse('Task not found', 'NOT_FOUND', {
        requestId,
        statusCode: 404,
      })
      logApiError(404, 'NOT_FOUND', errorId, requestId, organization_id, response.message, {
        category: 'validation',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 404,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    return NextResponse.json({ data: { id: taskId } })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to delete task',
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
