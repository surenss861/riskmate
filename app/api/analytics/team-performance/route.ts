import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getAnalyticsContext } from '@/lib/utils/analyticsAuth'
import { parsePeriod, parseSinceUntil, dateRangeForDays, effectiveDaysFromRange, periodLabelFromDays } from '@/lib/utils/analyticsDateRange'
import { calendarYearBounds } from '@/lib/utils/analyticsTrends'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/team-performance'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAnalyticsContext(request, ROUTE)
    if (ctx instanceof NextResponse) return ctx
    const { orgId, requestId, hasAnalytics, isActive, supabase } = ctx
    if (!isActive || !hasAnalytics) {
      return NextResponse.json(
        { period: '30d', members: [], locked: true },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }
    const { searchParams } = new URL(request.url)
    const sinceParam = searchParams.get('since')
    const untilParam = searchParams.get('until')
    const customRange = parseSinceUntil(sinceParam, untilParam)
    if (customRange && 'error' in customRange) {
      if (customRange.error === 'invalid_order') {
        const { response, errorId } = createErrorResponse(
          'Invalid date range: since must be before or equal to until',
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'VALIDATION_ERROR', errorId, requestId, undefined, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      if (customRange.error === 'invalid_format') {
        const { response, errorId } = createErrorResponse(
          'Invalid date format for since or until',
          'VALIDATION_ERROR',
          { requestId, statusCode: 400 }
        )
        logApiError(400, 'VALIDATION_ERROR', errorId, requestId, undefined, response.message, {
          category: 'validation', severity: 'warn', route: ROUTE,
        })
        return NextResponse.json(response, {
          status: 400,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
    }
    const customRangeValid = customRange && !('error' in customRange) ? customRange : null
    const parsed = parsePeriod(searchParams.get('period'))
    const { since, until } =
      customRangeValid ?? (parsed.key === '1y' ? calendarYearBounds() : dateRangeForDays(parsed.days))
    const periodLabel = customRangeValid ? periodLabelFromDays(effectiveDaysFromRange(since, until)) : (parsed.key === '1y' ? '1y' : `${parsed.days}d`)

    const { data: kpiRows, error: rpcError } = await supabase.rpc('get_team_performance_kpis', {
      p_org_id: orgId,
      p_since: since,
      p_until: until,
    })

    if (rpcError) throw rpcError

    const rows = (Array.isArray(kpiRows) ? kpiRows : []) as {
      user_id: string
      jobs_assigned: number
      jobs_completed: number
      sum_days: number
      count_completed: number
      overdue_count: number
    }[]

    const members = rows.map((r) => {
      const jobs_assigned = Number(r.jobs_assigned ?? 0)
      const jobs_completed = Number(r.jobs_completed ?? 0)
      const completion_rate =
        jobs_assigned === 0
          ? 0
          : Math.min(100, Math.max(0, Math.round((jobs_completed / jobs_assigned) * 10000) / 100))
      const count_completed = Number(r.count_completed ?? 0)
      const sum_days = Number(r.sum_days ?? 0)
      const avg_days = count_completed === 0 ? 0 : Math.round((sum_days / count_completed) * 100) / 100
      return {
        user_id: r.user_id,
        jobs_assigned,
        jobs_completed,
        completion_rate,
        avg_days,
        overdue_count: Number(r.overdue_count ?? 0),
      }
    })

    members.sort((a, b) => b.jobs_completed - a.jobs_completed)

    const userIds = members.map((m) => m.user_id)
    const userMap = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: nameRows } = await supabase.rpc('get_team_member_display_names', {
        p_org_id: orgId,
        p_user_ids: userIds,
      })
      for (const row of (nameRows ?? []) as { user_id: string; display_name: string | null }[]) {
        const name = (row.display_name ?? '').trim() || 'Unknown'
        userMap.set(row.user_id, name)
      }
    }

    const membersWithNames = members.map((m) => ({
      ...m,
      name: userMap.get(m.user_id) ?? 'Unknown',
    }))

    return NextResponse.json(
      { period: periodLabel, members: membersWithNames },
      { status: 200, headers: { 'X-Request-ID': requestId } }
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Analytics team-performance error:', error)
    const rid = getRequestId(request)
    const { response, errorId } = createErrorResponse(
      'Failed to fetch team performance',
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
