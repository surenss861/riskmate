import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { handleApiError, API_ERROR_CODES } from '@/lib/utils/apiErrors'

export const runtime = 'nodejs'

/**
 * GET /api/access/export
 * Exports access change log (role changes, grants, revokes, logins)
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    let organization_id: string
    try {
      const context = await getOrganizationContext(request)
      organization_id = context.organization_id
    } catch (authError: any) {
      console.error('[access/export] Auth error:', {
        message: authError.message,
        requestId,
      })
      const { response, errorId } = createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED.defaultMessage,
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: '/api/access/export',
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    
    const { searchParams } = request.nextUrl
    const format = searchParams.get('format') || 'json'
    const time_range = searchParams.get('time_range') || '30d'

    const supabase = await createSupabaseServerClient()

    // Query access-related events
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('category', 'access_review')
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
      console.error('[access/export] Query error:', { code: error.code, message: error.message, requestId })
      const { response, errorId } = createErrorResponse(
        API_ERROR_CODES.QUERY_ERROR.defaultMessage,
        'QUERY_ERROR',
        {
          requestId,
          statusCode: 500,
          details: {
            databaseError: { code: error.code, message: error.message },
          },
        }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, organization_id, response.message, {
        category: 'internal', severity: 'error', route: '/api/access/export',
        details: { databaseError: { code: error.code, message: error.message } },
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const eventList = events || []

    if (format === 'csv') {
      const headers = ['ID', 'Event Name', 'Created At', 'Actor', 'Target User', 'Action', 'Summary']
      const rows = eventList.map((e: any) => [
        e.id,
        e.event_name || '',
        e.created_at || '',
        e.actor_email || e.actor_name || '',
        e.metadata?.target_user_name || '',
        e.metadata?.action || '',
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
          'Content-Disposition': `attachment; filename="access-export-${new Date().toISOString().split('T')[0]}.csv"`,
          'X-Request-ID': requestId,
          'X-Exported-At': exportedAt,
          'X-Export-Format': 'csv',
          'X-Export-View': 'access-review',
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
          view: 'access-review',
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
        'Content-Type': 'application/json; charset=utf-8',
      }
    })
  } catch (error: unknown) {
    console.error('[access/export] Error:', { requestId }, error)
    return handleApiError(error, requestId)
  }
}

