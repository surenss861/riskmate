import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyOrganizationOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { mapTaskToApiShape } from '@/lib/utils/taskApiShape'

export const runtime = 'nodejs'

const ROUTE = '/api/tasks/[id]/reopen'

export async function POST(
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
    const msg = error?.message || 'Failed to reopen task'
    const isNotFound =
      error?.code === 'PGRST116' ||
      (typeof msg === 'string' &&
        (msg.includes('Resource not found') || msg.includes('PGRST116') || msg.includes('not found')))
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
