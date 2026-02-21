import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { mapTaskToApiShape } from '@/lib/utils/taskApiShape'
import { getSessionToken, BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const ROUTE = '/api/jobs/[id]/tasks'

const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
    const { id: jobId } = await params

    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*, assignee:assigned_to(id, full_name, email)')
      .eq('job_id', jobId)
      .eq('organization_id', organization_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    const data = (tasks || []).map((t) => mapTaskToApiShape(t))
    return NextResponse.json({ data })
  } catch (error: any) {
    const msg = error?.message || 'Failed to fetch tasks'
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const { id: jobId } = await params

    await verifyJobOwnership(jobId, organization_id)

    const body = await request.json().catch(() => ({}))
    const { title, description, assigned_to, priority, due_date, sort_order, status } = body

    if (!title || typeof title !== 'string' || !title.trim()) {
      const { response, errorId } = createErrorResponse(
        'title is required',
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

    if (assigned_to != null) {
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

    const resolvedStatus = status ?? 'todo'
    const nowIso = new Date().toISOString()
    const insertPayload: Record<string, unknown> = {
      organization_id,
      job_id: jobId,
      created_by: user_id,
      title: title.trim(),
      description: description ?? null,
      assigned_to: assigned_to ?? null,
      priority: priority ?? 'medium',
      due_date: due_date ?? null,
      sort_order: sort_order ?? 0,
      status: resolvedStatus,
    }
    if (resolvedStatus === 'done') {
      insertPayload.completed_at = nowIso
      insertPayload.completed_by = user_id
    }

    const supabase = await createSupabaseServerClient()
    const { data: task, error } = await supabase
      .from('tasks')
      .insert(insertPayload)
      .select('*, assignee:assigned_to(id, full_name, email)')
      .single()

    if (error || !task) {
      throw error || new Error('Failed to create task')
    }

    if (assigned_to && BACKEND_URL) {
      const { data: job } = await supabase
        .from('jobs')
        .select('client_name')
        .eq('id', jobId)
        .eq('organization_id', organization_id)
        .maybeSingle()

      const jobTitle = job?.client_name || 'Job'
      const token = await getSessionToken(request)
      if (token) {
        fetch(`${BACKEND_URL}/api/notifications/task-assigned`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: assigned_to,
            taskId: task.id,
            taskTitle: task.title,
            jobId,
            jobTitle,
          }),
        }).catch((err) => {
          console.warn('[Tasks] Task assigned notification (push/email) failed:', err)
        })
      }
    }

    const data = mapTaskToApiShape(task)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    const msg = error?.message || 'Failed to create task'
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
