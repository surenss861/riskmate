import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { getRequestId } from '@/lib/utils/requestId'
import { createSuccessResponse, createErrorResponse, ExportResponse } from '@/lib/utils/apiResponse'
import { handleApiError, API_ERROR_CODES } from '@/lib/utils/apiErrors'

export const runtime = 'nodejs'

/**
 * GET /api/review-queue/export
 * Exports review queue items as CSV or JSON
 * Filter-based (no selection required)
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    let organization_id: string
    try {
      const context = await getOrganizationContext(request)
      organization_id = context.organization_id
    } catch (authError: any) {
      console.error('[review-queue/export] Auth error:', {
        message: authError.message,
        requestId,
      })
      const errorResponse = createErrorResponse(
        API_ERROR_CODES.UNAUTHORIZED.defaultMessage,
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      return NextResponse.json(errorResponse, { 
        status: 401,
        headers: { 'X-Request-ID': requestId }
      })
    }
    
    const { searchParams } = request.nextUrl
    const format = searchParams.get('format') || 'json' // 'csv' | 'json'
    const time_range = searchParams.get('time_range') || '30d'
    const category = searchParams.get('category')
    const severity = searchParams.get('severity')
    const outcome = searchParams.get('outcome')

    const supabase = await createSupabaseServerClient()

    // Build query for review queue (blocked/flagged items)
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('outcome', 'blocked') // Review queue = blocked actions
      .order('created_at', { ascending: false })

    // Apply filters
    if (category) query = query.eq('category', category)
    if (severity) query = query.eq('severity', severity)
    if (outcome) query = query.eq('outcome', outcome)

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
      console.error('[review-queue/export] Query error:', {
        code: error.code,
        message: error.message,
        requestId,
        organization_id,
      })
      const errorResponse = createErrorResponse(
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
      return NextResponse.json(errorResponse, { 
        status: 500,
        headers: { 'X-Request-ID': requestId }
      })
    }

    // Handle empty results gracefully
    const eventList = events || []

    // Format response
    if (format === 'csv') {
      // Generate CSV - always include headers even for empty results
      const headers = ['ID', 'Event Name', 'Category', 'Severity', 'Created At', 'Actor', 'Target Type', 'Target ID', 'Summary']
      const rows = eventList.map((e: any) => [
        e.id,
        e.event_name || '',
        e.category || '',
        e.severity || '',
        e.created_at || '',
        e.actor_email || e.actor_name || '',
        e.target_type || '',
        e.target_id || '',
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
          'Content-Disposition': `attachment; filename="review-queue-export-${new Date().toISOString().split('T')[0]}.csv"`,
          'X-Request-ID': requestId,
          'X-Exported-At': exportedAt,
          'X-Export-Format': 'csv',
          'X-Export-View': 'review-queue',
          'X-Export-Count': eventList.length.toString(),
          ...(time_range && { 'X-Export-Filter-TimeRange': time_range }),
          ...(category && { 'X-Export-Filter-Category': category }),
          ...(severity && { 'X-Export-Filter-Severity': severity }),
          ...(outcome && { 'X-Export-Filter-Outcome': outcome }),
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
          view: 'review-queue',
          filters: {
            time_range,
            category,
            severity,
            outcome,
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
    console.error('[review-queue/export] Error:', { requestId }, error)
    return handleApiError(error, requestId)
  }
}

