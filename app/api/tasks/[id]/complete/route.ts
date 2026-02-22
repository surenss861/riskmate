import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyOrganizationOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { mapTaskToApiShape } from '@/lib/utils/taskApiShape'
import { getSessionToken, BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

const ROUTE = '/api/tasks/[id]/complete'

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

    if (existingTask.created_by && BACKEND_URL) {
      const token = await getSessionToken(request)
      if (token) {
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

    const data = mapTaskToApiShape(updatedTask)
    return NextResponse.json({ data })
  } catch (error: any) {
    const msg = error?.message || 'Failed to complete task'
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
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .eq('organization_id', organization_id)
      .single()

    if (fetchError || !existingTask) {
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

    const nowIso = new Date().toISOString()
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
    const msg = error?.message || 'Failed to reopen task'
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
