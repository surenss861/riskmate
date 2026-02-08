import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/utils/rateLimiter'

export const runtime = 'nodejs'

/**
 * GET /api/incidents/export
 * Exports incident timeline + actions + evidence links
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

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
      const errorResponse = createErrorResponse(
        'Unauthorized: Please log in to export data',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Rate limit: 10 exports per hour per org
    const rateLimitResult = checkRateLimit(request, RATE_LIMIT_PRESETS.export, {
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
      const errorResponse = createErrorResponse(
        'Rate limit exceeded. Please try again later.',
        'RATE_LIMIT_EXCEEDED',
        {
          requestId,
          statusCode: 429,
          retryable: true,
          retry_after_seconds: rateLimitResult.retryAfter,
          details: {
            limit: rateLimitResult.limit,
            window: '1 hour',
            resetAt: rateLimitResult.resetAt,
          },
        }
      )
      return NextResponse.json(errorResponse, {
        status: 429,
        headers: {
          'X-Request-ID': requestId,
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
      const errorResponse = createErrorResponse(
        'Failed to fetch incident events',
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
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: { 'X-Request-ID': requestId }
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
  } catch (error: any) {
    console.error('[incidents/export] Error:', {
      message: error.message,
      stack: error.stack,
      requestId,
    })
    const errorResponse = createErrorResponse(
      error.message || 'Failed to export incidents',
      error.code || 'EXPORT_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined,
      }
    )
    return NextResponse.json(errorResponse, { 
      status: 500,
      headers: { 'X-Request-ID': requestId }
    })
  }
}

