import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext, verifyOrganizationOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { mapTaskToApiShape } from '@/lib/utils/taskApiShape'

export const runtime = 'nodejs'

const ROUTE = '/api/tasks/[id]'

const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
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

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to
    if (priority !== undefined) updateData.priority = priority
    if (due_date !== undefined) updateData.due_date = due_date
    if (status !== undefined) updateData.status = status
    if (sort_order !== undefined) updateData.sort_order = sort_order

    const supabase = await createSupabaseServerClient()
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
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('organization_id', organization_id)

    if (error) {
      throw error
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
