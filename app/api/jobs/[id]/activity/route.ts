import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'
import { logApiError } from '@/lib/utils/errorLogging'
import { handleApiError } from '@/lib/utils/apiErrors'

export const runtime = 'nodejs'

const ROUTE = '/api/jobs/[id]/activity'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const VALID_CATEGORIES = [
  'governance',
  'operations',
  'access',
  'review_queue',
  'incident_review',
  'attestations',
  'system',
  'access_review',
] as const

function isValidUuid(s: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(s)
}

function isValidIsoDate(s: string): boolean {
  const d = new Date(s)
  return !Number.isNaN(d.getTime())
}

/**
 * GET /api/jobs/[id]/activity
 * Returns activity events for a specific job with optional filtering and pagination.
 * Query params: limit, offset, actor_id, event_type, category, start_date, end_date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)

  try {
    const { organization_id } = await getOrganizationContext(request)
    const { id: jobId } = await params

    if (!jobId || !isValidUuid(jobId)) {
      const { response, errorId } = createErrorResponse(
        'Invalid job ID',
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

    const adminSupabase = createSupabaseAdminClient()

    // Use admin client to bypass RLS: missing jobs → 404, wrong org → 403
    const { data: job, error: jobError } = await adminSupabase
      .from('jobs')
      .select('id, organization_id')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError) {
      const { response, errorId } = createErrorResponse(
        'Failed to fetch job',
        'QUERY_ERROR',
        { requestId, statusCode: 500, details: { databaseError: jobError.message } }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, organization_id, response.message, {
        category: 'internal',
        severity: 'error',
        route: ROUTE,
        details: { databaseError: jobError.message },
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    if (!job) {
      const { response, errorId } = createErrorResponse(
        'Job not found',
        'NOT_FOUND',
        { requestId, statusCode: 404 }
      )
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

    if (job.organization_id !== organization_id) {
      const { response, errorId } = createErrorResponse(
        'You do not have permission to access this job',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      logApiError(403, 'FORBIDDEN', errorId, requestId, organization_id, response.message, {
        category: 'auth',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const supabase = await createSupabaseServerClient()

    const { searchParams } = request.nextUrl
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const actor_id = searchParams.get('actor_id')
    const event_type = searchParams.get('event_type')
    const category = searchParams.get('category')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    let limit = DEFAULT_LIMIT
    if (limitParam !== null && limitParam !== '') {
      const parsed = parseInt(limitParam, 10)
      if (Number.isNaN(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
        const { response, errorId } = createErrorResponse(
          `limit must be between 1 and ${MAX_LIMIT}`,
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
      limit = parsed
    }

    let offset = 0
    if (offsetParam !== null && offsetParam !== '') {
      const parsed = parseInt(offsetParam, 10)
      if (Number.isNaN(parsed) || parsed < 0) {
        const { response, errorId } = createErrorResponse(
          'offset must be a non-negative integer',
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
      offset = parsed
    }

    if (actor_id !== null && actor_id !== '' && !isValidUuid(actor_id)) {
      const { response, errorId } = createErrorResponse(
        'actor_id must be a valid UUID',
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

    if (category !== null && category !== '' && !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      const { response, errorId } = createErrorResponse(
        `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
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

    if (start_date !== null && start_date !== '' && !isValidIsoDate(start_date)) {
      const { response, errorId } = createErrorResponse(
        'start_date must be a valid ISO date string',
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

    if (end_date !== null && end_date !== '' && !isValidIsoDate(end_date)) {
      const { response, errorId } = createErrorResponse(
        'end_date must be a valid ISO date string',
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

    if (start_date && end_date) {
      const startTime = new Date(start_date).getTime()
      const endTime = new Date(end_date).getTime()
      if (startTime > endTime) {
        const { response, errorId } = createErrorResponse(
          'start_date must be before or equal to end_date',
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

    // Include rows where target is the job OR metadata.job_id references this job (e.g. document.uploaded)
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('organization_id', organization_id)
      .or(`and(target_type.eq.job,target_id.eq.${jobId}),metadata->>job_id.eq.${jobId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (actor_id) query = query.eq('actor_id', actor_id)
    if (event_type) query = query.eq('event_name', event_type)
    if (category) query = query.eq('category', category)
    if (start_date) query = query.gte('created_at', start_date)
    if (end_date) query = query.lte('created_at', end_date)

    const { data: events, error, count } = await query

    if (error) {
      const { response, errorId } = createErrorResponse(
        'Failed to fetch job activity',
        'QUERY_ERROR',
        {
          requestId,
          statusCode: 500,
          details: { databaseError: error.message },
        }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, organization_id, response.message, {
        category: 'internal',
        severity: 'error',
        route: ROUTE,
        details: { databaseError: error.message },
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const total = count ?? 0
    const list = events ?? []

    const actorIds = [...new Set(list.map((e: { actor_id?: string }) => e.actor_id).filter(Boolean))] as string[]
    const actorMap = new Map<string, { full_name: string | null; email: string | null; role: string | null }>()

    if (actorIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('organization_id', organization_id)
        .in('id', actorIds)

      if (usersError) {
        const { response, errorId } = createErrorResponse(
          'Failed to fetch actor metadata',
          'QUERY_ERROR',
          {
            requestId,
            statusCode: 500,
            details: { databaseError: usersError.message },
          }
        )
        logApiError(500, 'QUERY_ERROR', errorId, requestId, organization_id, response.message, {
          category: 'internal',
          severity: 'error',
          route: ROUTE,
          details: { databaseError: usersError.message },
        })
        return NextResponse.json(response, {
          status: 500,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }

      for (const u of users ?? []) {
        actorMap.set(u.id, {
          full_name: u.full_name ?? null,
          email: u.email ?? null,
          role: u.role ?? null,
        })
      }
    }

    const enrichedEvents = list.map((event: Record<string, unknown>) => {
      const out: Record<string, unknown> = { ...event, event_type: event.event_name }
      const actorId = event.actor_id as string | undefined
      if (actorId) {
        const actor = actorMap.get(actorId)
        if (actor) {
          out.actor_name = actor.full_name ?? 'Unknown'
          out.actor_email = actor.email ?? ''
          out.actor_role = actor.role ?? 'member'
        }
      }
      return out
    })

    const payload = {
      events: enrichedEvents,
      total,
      has_more: offset + enrichedEvents.length < total,
    }

    const successResponse = createSuccessResponse(payload, { requestId })
    return NextResponse.json(successResponse, {
      headers: { 'X-Request-ID': requestId },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to access this resource',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    if (error instanceof Error && error.message.includes('Access denied')) {
      const { response, errorId } = createErrorResponse(
        'You do not have permission to access this job',
        'FORBIDDEN',
        { requestId, statusCode: 403 }
      )
      logApiError(403, 'FORBIDDEN', errorId, requestId, undefined, response.message, {
        category: 'auth',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    return handleApiError(error, requestId, undefined, {
      route: ROUTE,
    })
  }
}
