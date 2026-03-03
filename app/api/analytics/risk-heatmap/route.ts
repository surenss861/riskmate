import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getAnalyticsContext } from '@/lib/utils/analyticsAuth'
import { parsePeriod, parseSinceUntil, dateRangeForDays } from '@/lib/utils/analyticsDateRange'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/risk-heatmap'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAnalyticsContext(request, ROUTE)
    if (ctx instanceof NextResponse) return ctx
    const { orgId, requestId, hasAnalytics, isActive } = ctx
    if (!isActive || !hasAnalytics) {
      return NextResponse.json(
        { period: '30d', buckets: [], locked: true },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    const supabase = await createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const sinceParam = searchParams.get('since')
    const untilParam = searchParams.get('until')
    const customRange = parseSinceUntil(sinceParam, untilParam)
    const { days } = parsePeriod(searchParams.get('period'))
    const { since, until } = customRange ?? dateRangeForDays(days)

    const { data: rows, error } = await supabase.rpc('get_risk_heatmap_buckets', {
      p_org_id: orgId,
      p_since: since,
      p_until: until,
    })

    if (error) throw error

    const list = (Array.isArray(rows) ? rows : []) as {
      job_type: string
      day_of_week: number
      avg_risk: number
      count: number
    }[]
    const buckets = list.map((r) => ({
      job_type: r.job_type ?? 'other',
      day_of_week: Number(r.day_of_week ?? 0),
      avg_risk: Number(r.avg_risk ?? 0),
      count: Number(r.count ?? 0),
    }))

    return NextResponse.json(
      { period: `${days}d`, buckets },
      { status: 200, headers: { 'X-Request-ID': requestId } }
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Analytics risk-heatmap error:', error)
    const rid = getRequestId(request)
    const { response, errorId } = createErrorResponse(
      'Failed to fetch risk heatmap',
      'QUERY_ERROR',
      {
        requestId: rid,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: err?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, rid, undefined, response.message, {
      category: 'internal', severity: 'error', route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: err?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': rid, 'X-Error-ID': errorId },
    })
  }
}
