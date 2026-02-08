import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { handleApiError, API_ERROR_CODES } from '@/lib/utils/apiErrors'
import { checkRateLimitWithContext, RATE_LIMIT_CONFIGS, type RateLimitResult } from '@/lib/utils/rateLimiter'

export const runtime = 'nodejs'

const ROUTE = '/api/incidents/export'

/**
 * GET /api/incidents/export
 * Exports incident timeline + actions + evidence links
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  let rateLimitResult: RateLimitResult | null = null

  try {
    let organization_id: string
    let user_id: string
    try {
      const context = await getOrganizationContext(request)
      organization_id = context.organization_id
      user_id = context.user_id
    } catch (authError: any) {
      console.error('[incidents/export] Auth error:', {
        message: authError.message,
        requestId,
      })
      const { response, errorId } = createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED.defaultMessage,
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

    // Rate limit: 10 exports per hour per org
    rateLimitResult = checkRateLimitWithContext(request, RATE_LIMIT_CONFIGS.export, {
      organization_id,
      user_id,
    })
    if (!rateLimitResult.allowed) {
      console.log(JSON.stringify({
        event: 'rate_limit_exceeded',
        organization_id,
        user_id,
        endpoint: request.nextUrl?.pathname,
        limit: rateLimitResult.limit,
        window_ms: rateLimitResult.windowMs,
        retry_after: rateLimitResult.retryAfter,
        request_id: requestId,
      }))
      const { response, errorId } = createErrorResponse(
        API_ERROR_CODES.RATE_LIMIT_EXCEEDED.defaultMessage,
        'RATE_LIMIT_EXCEEDED',
        {
          requestId,
          statusCode: 429,
          retry_after_seconds: rateLimitResult.retryAfter,
          details: {
            limit: rateLimitResult.limit,
            window: '1 hour',
            resetAt: rateLimitResult.resetAt,
          },
        }
      )
      logApiError(429, 'RATE_LIMIT_EXCEEDED', errorId, requestId, organization_id, response.message, {
        category: 'internal',
        severity: 'warn',
        route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 429,
        headers: {
          'X-Request-ID': requestId,
          'X-Error-ID': errorId,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          'Retry-After': String(rateLimitResult.retryAfter),
        },
      })
    }
    
    const { searchParams } = request.nextUrl
    const format = searchParams.get('format') || 'json'
    const time_range = searchParams.get('time_range') || '30d'

    const supabase = await createSupabaseServerClient()

    // Query incident-related events
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('category', 'incident_review')
      .order('created_at', { ascending: false })

    // Time range filter
    if (time_range !== 'all') {
      const now = new Date()
      let cutoff = new Date()
      if (time_range === '24h') {
        cutoff.setHours(now.getHours() - 24)
      } else if (time_range === '7d') {
        cutoff.setDate(now.getDate() - 7)
      } else if (time_range === '30d') {
        cutoff.setDate(now.getDate() - 30)
      }
      query = query.gte('created_at', cutoff.toISOString())
    }

    const { data: events, error } = await query

    if (error) {
      console.error('[incidents/export] Query error:', {
        code: error.code,
        message: error.message,
        requestId,
        organization_id,
      })
      const { response, errorId } = createErrorResponse(
        API_ERROR_CODES.QUERY_ERROR.defaultMessage,
        'QUERY_ERROR',
        {
          requestId,
          statusCode: 500,
          details: {
            databaseError: {
              code: error.code,
              message: error.message,
            },
          },
        }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, organization_id, response.message, {
        category: 'internal',
        severity: 'error',
        route: ROUTE,
        details: { databaseError: { code: error.code, message: error.message } },
      })
      return NextResponse.json(response, {
        status: 500,
        headers: {
          'X-Request-ID': requestId,
          'X-Error-ID': errorId,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        },
      })
    }

    const eventList = events || []

    if (format === 'csv') {
      const headers = ['ID', 'Event Name', 'Work Record ID', 'Created At', 'Actor', 'Severity', 'Summary']
      const rows = eventList.map((e: any) => [
        e.id,
        e.event_name || '',
        e.work_record_id || e.job_id || '',
        e.created_at || '',
        e.actor_email || e.actor_name || '',
        e.severity || '',
        e.summary || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map((r: any[]) => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      // CSV exports: meta goes in headers, not body (body is pure CSV text)
      const exportedAt = new Date().toISOString()
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="incidents-export-${new Date().toISOString().split('T')[0]}.csv"`,
          'X-Request-ID': requestId,
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          'X-Exported-At': exportedAt,
          'X-Export-Format': 'csv',
          'X-Export-View': 'incident-review',
          'X-Export-Count': eventList.length.toString(),
          ...(time_range && { 'X-Export-Filter-TimeRange': time_range }),
        },
      })
    }

    // JSON format
    const successResponse = createSuccessResponse(
      eventList,
      {
        count: eventList.length,
        meta: {
          exportedAt: new Date().toISOString(),
          format: 'json' as const,
          view: 'incident-review',
          filters: {
            time_range,
          },
          requestId,
        },
      }
    )
    return NextResponse.json(successResponse, {
      headers: { 
        'X-Request-ID': requestId,
        'X-RateLimit-Limit': String(rateLimitResult.limit),
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        'Content-Type': 'application/json; charset=utf-8',
      }
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[incidents/export] Error:', {
      message: err.message,
      stack: err.stack,
      requestId,
    })
    const rateLimitHeaders =
      rateLimitResult != null
        ? {
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          }
        : undefined
    return handleApiError(error, requestId, rateLimitHeaders, { route: ROUTE })
  }
}

