import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'
import { getRequestId } from '@/lib/utils/requestId'
import { logApiError } from '@/lib/utils/errorLogging'
import { handleApiError } from '@/lib/utils/apiErrors'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const ROUTE = '/api/jobs/[id]/activity/subscribe'

/** Channel ID for Realtime subscription to audit_logs where target_id = jobId. Must match lib/realtime/eventSubscription.ts */
function getJobActivityChannelId(organizationId: string, jobId: string): string {
  return `job-activity-${organizationId}-${jobId}`
}

function isValidUuid(s: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(s)
}

/**
 * POST /api/jobs/[id]/activity/subscribe
 * Returns a Supabase Realtime channel ID and organizationId for subscribing to audit_logs.
 * Client should use subscribeToJobActivity(jobId, organizationId, onEvent) with the same jobId and organizationId.
 */
export async function POST(
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

    const channelId = getJobActivityChannelId(organization_id, jobId)
    const payload = { channelId, organizationId: organization_id, requestId }
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
