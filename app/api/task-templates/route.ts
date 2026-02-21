import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/task-templates'

const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
const TASK_STATUSES = ['todo', 'in_progress', 'done', 'cancelled'] as const

type ValidatedTaskItem = {
  title: string
  description: string | null
  priority: string
  status: string
  due_date: string | null
  sort_order: number
  assigned_to: string | null
}

function validateTemplateTaskItem(
  item: unknown,
  index: number
): { ok: true; task: ValidatedTaskItem } | { ok: false; message: string } {
  const raw = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
  const titleRaw = raw?.title
  if (titleRaw === undefined || titleRaw === null || typeof titleRaw !== 'string') {
    return { ok: false, message: `tasks[${index}]: title is required` }
  }
  const title = String(titleRaw).trim()
  if (!title) {
    return { ok: false, message: `tasks[${index}]: title cannot be empty or whitespace` }
  }

  const priorityRaw = raw?.priority
  const priority =
    priorityRaw === undefined || priorityRaw === null
      ? 'medium'
      : (typeof priorityRaw === 'string' ? priorityRaw : String(priorityRaw)).toLowerCase()
  if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) {
    return { ok: false, message: `tasks[${index}]: priority must be one of: low, medium, high, urgent` }
  }

  const statusRaw = raw?.status
  const status =
    statusRaw === undefined || statusRaw === null
      ? 'todo'
      : (typeof statusRaw === 'string' ? statusRaw : String(statusRaw)).toLowerCase()
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: `tasks[${index}]: status must be one of: todo, in_progress, done, cancelled` }
  }

  const description =
    raw?.description === undefined || raw?.description === null
      ? null
      : typeof raw.description === 'string'
        ? raw.description
        : String(raw.description)
  const due_date =
    raw?.due_date === undefined || raw?.due_date === null
      ? null
      : typeof raw.due_date === 'string'
        ? raw.due_date
        : typeof raw.due_date === 'number'
          ? String(raw.due_date)
          : null
  const sort_order =
    typeof raw?.sort_order === 'number' && Number.isFinite(raw.sort_order)
      ? raw.sort_order
      : typeof raw?.sort_order === 'string'
        ? parseInt(raw.sort_order, 10)
        : 0
  const assigned_to =
    raw?.assigned_to === undefined || raw?.assigned_to === null
      ? null
      : typeof raw.assigned_to === 'string'
        ? raw.assigned_to
        : null

  return {
    ok: true,
    task: {
      title,
      description,
      priority,
      status,
      due_date,
      sort_order: Number.isFinite(sort_order) ? sort_order : 0,
      assigned_to,
    },
  }
}

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

    const validatedTasks: ValidatedTaskItem[] = []
    for (let i = 0; i < tasks.length; i++) {
      const result = validateTemplateTaskItem(tasks[i], i)
      if (!result.ok) {
        const { response, errorId } = createErrorResponse(
          result.message,
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
      validatedTasks.push(result.task)
    }

    const supabase = await createSupabaseServerClient()
    const { data: template, error } = await supabase
      .from('task_templates')
      .insert({
        organization_id,
        created_by: user_id,
        is_default: false,
        name: name.trim(),
        tasks: validatedTasks,
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
