import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/task-templates'

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
    const supabase = await createSupabaseServerClient()

    const { data: templates, error } = await supabase
      .from('task_templates')
      .select('*')
      .or(`organization_id.eq.${organization_id},is_default.eq.true`)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ data: templates || [] })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to fetch task templates',
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

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const { organization_id, user_id } = await getOrganizationContext(request)
    const body = await request.json()
    const { name, tasks, job_type } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      const { response, errorId } = createErrorResponse(
        'name is required',
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

    if (!Array.isArray(tasks) || tasks.length === 0) {
      const { response, errorId } = createErrorResponse(
        'tasks must be a non-empty array',
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

    const supabase = await createSupabaseServerClient()
    const { data: template, error } = await supabase
      .from('task_templates')
      .insert({
        organization_id,
        created_by: user_id,
        is_default: false,
        name: name.trim(),
        tasks,
        job_type: job_type ?? null,
      })
      .select('*')
      .single()

    if (error || !template) {
      throw error || new Error('Failed to create task template')
    }

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (error: any) {
    const { response, errorId } = createErrorResponse(
      error?.message || 'Failed to create task template',
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
