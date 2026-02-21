import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { mapTaskToApiShape } from '@/lib/utils/taskApiShape'

export const runtime = 'nodejs'

const ROUTE = '/api/jobs/[id]/tasks'

const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

async function createTaskAssignedNotificationRecord(
  userId: string,
  organizationId: string,
  taskId: string,
  jobId: string,
  taskTitle: string,
  jobTitle?: string | null
) {
  const admin = createSupabaseAdminClient()
  await admin.from('notifications').insert({
    user_id: userId,
    organization_id: organizationId,
    type: 'task_assigned',
    content: `You've been assigned '${taskTitle}' on '${jobTitle || 'Job'}'`,
    is_read: false,
    deep_link: `riskmate://jobs/${jobId}/tasks/${taskId}`,
  })
}

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
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to fetch tasks',
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const { id: jobId } = await params

    await verifyJobOwnership(jobId, organization_id)

    const body = await request.json()
    const { title, description, assigned_to, priority, due_date, sort_order } = body

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

    if (priority !== undefined && (typeof priority !== 'string' || !TASK_PRIORITIES.includes(priority))) {
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

    const supabase = await createSupabaseServerClient()
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        organization_id,
        job_id: jobId,
        created_by: user_id,
        title: title.trim(),
        description: description ?? null,
        assigned_to: assigned_to ?? null,
        priority: priority ?? 'medium',
        due_date: due_date ?? null,
        sort_order: sort_order ?? 0,
      })
      .select('*, assignee:assigned_to(id, full_name, email)')
      .single()

    if (error || !task) {
      throw error || new Error('Failed to create task')
    }

    if (assigned_to) {
      const { data: job } = await supabase
        .from('jobs')
        .select('client_name')
        .eq('id', jobId)
        .eq('organization_id', organization_id)
        .maybeSingle()

      const jobTitle = job?.client_name || 'Job'
      await createTaskAssignedNotificationRecord(
        assigned_to,
        organization_id,
        task.id,
        jobId,
        task.title,
        jobTitle
      )
    }

    const data = mapTaskToApiShape(task)
    return NextResponse.json({ data }, { status: 201 })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to create task',
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
