import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getAnalyticsContext } from '@/lib/utils/analyticsAuth'
import { parseSinceUntil, effectiveDaysFromRange } from '@/lib/utils/analyticsDateRange'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/mitigations'

function parseRangeDays(range?: string | null): number {
  if (range == null || range === '') return 30
  const str = String(range).trim().toLowerCase()
  if (str === '7d') return 7
  if (str === '30d') return 30
  if (str === '90d') return 90
  if (str === '1y') return 365 // unclamped for calendar-year path
  const match = str.match(/(\d+)/)
  if (!match) return 30
  const days = parseInt(match[1], 10)
  if (Number.isNaN(days) || days <= 0) return 30
  return Math.min(days, 180)
}

/** Calendar-year bounds (Jan 1 00:00 to today 23:59:59 UTC). */
function calendarYearBounds(): { since: string; until: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const since = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
  const until = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  return { since: since.toISOString(), until: until.toISOString() }
}

/** Rolling-window bounds for the last N days. */
function rollingDaysBounds(days: number): { since: string; until: string } {
  const until = new Date()
  until.setHours(23, 59, 59, 999)
  const since = new Date(until.getTime())
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)
  return { since: since.toISOString(), until: until.toISOString() }
}

function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAnalyticsContext(request, ROUTE)
    if (ctx instanceof NextResponse) return ctx
    const { orgId, requestId, hasAnalytics, isActive, status } = ctx
    if (!isActive || !hasAnalytics) {
      const rangeDays = parseRangeDays(new URL(request.url).searchParams.get('range') || undefined)
      return NextResponse.json(
        {
          org_id: orgId,
          range_days: rangeDays,
          completion_rate: 0,
          avg_time_to_close_hours: 0,
          high_risk_jobs: 0,
          evidence_count: 0,
          jobs_with_evidence: 0,
          jobs_without_evidence: 0,
          avg_time_to_first_evidence_hours: 0,
          trend: [],
          jobs_total: 0,
          jobs_scored: 0,
          jobs_with_any_evidence: 0,
          jobs_with_photo_evidence: 0,
          jobs_missing_required_evidence: 0,
          required_evidence_policy: null,
          avg_time_to_first_photo_minutes: null,
          trend_empty_reason: 'no_jobs',
          locked: true,
          message:
            status === 'none'
              ? 'Analytics requires an active subscription'
              : 'Analytics not available on your current plan',
        },
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
    const rangeParam = searchParams.get('range')?.trim()?.toLowerCase()

    let sinceIso: string
    let untilIso: string
    let rangeDays: number

    if (customRangeValid) {
      sinceIso = customRangeValid.since
      untilIso = customRangeValid.until
      rangeDays = effectiveDaysFromRange(sinceIso, untilIso)
    } else if (rangeParam === '1y' || rangeParam === '365d') {
      const bounds = calendarYearBounds()
      sinceIso = bounds.since
      untilIso = bounds.until
      rangeDays = 365
    } else {
      rangeDays = parseRangeDays(searchParams.get('range') || undefined)
      const bounds = rollingDaysBounds(rangeDays)
      sinceIso = bounds.since
      untilIso = bounds.until
    }

    const crewId = searchParams.get('crew_id') || undefined

    const { supabase } = ctx

    // Server-side aggregation: one RPC for KPIs, one for daily trend (O(1) queries)
    const [kpisResult, trendResult] = await Promise.all([
      supabase.rpc('get_mitigations_analytics_kpis', {
        p_org_id: orgId,
        p_since: sinceIso,
        p_until: untilIso,
        p_crew_id: crewId || null,
      }),
      supabase.rpc('get_mitigations_analytics_trend', {
        p_org_id: orgId,
        p_since: sinceIso,
        p_until: untilIso,
        p_crew_id: crewId || null,
      }),
    ])

    if (kpisResult.error) throw kpisResult.error
    if (trendResult.error) {
      console.error('Mitigations analytics trend RPC error:', trendResult.error)
      throw trendResult.error
    }
    const row = Array.isArray(kpisResult.data) ? kpisResult.data[0] : kpisResult.data
    const trendRows = (trendResult.data ?? []) as Array<{ period_key: string; completion_rate: number }>

    const jobsTotal = Number(row?.jobs_total ?? 0)
    if (jobsTotal === 0) {
      return NextResponse.json({
        org_id: orgId,
        range_days: rangeDays,
        completion_rate: 0,
        avg_time_to_close_hours: 0,
        high_risk_jobs: 0,
        evidence_count: 0,
        jobs_with_evidence: 0,
        jobs_without_evidence: 0,
        avg_time_to_first_evidence_hours: 0,
        trend: [],
        jobs_total: 0,
        jobs_scored: 0,
        jobs_with_any_evidence: 0,
        jobs_with_photo_evidence: 0,
        jobs_missing_required_evidence: 0,
        required_evidence_policy: 'Photo required for high-risk jobs',
        avg_time_to_first_photo_minutes: null,
        trend_empty_reason: 'no_jobs',
      }, { status: 200, headers: { 'X-Request-ID': requestId } })
    }

    const trendByDate = new Map<string, number>()
    for (const r of trendRows) {
      const key = typeof r.period_key === 'string' ? r.period_key.slice(0, 10) : toDateKey(new Date(r.period_key))
      trendByDate.set(key, Number(r.completion_rate))
    }
    const trend: { date: string; completion_rate: number }[] = []
    const dateCursor = new Date(sinceIso)
    dateCursor.setHours(0, 0, 0, 0)
    const untilDate = new Date(untilIso)
    untilDate.setHours(23, 59, 59, 999)
    while (dateCursor <= untilDate) {
      const dateKey = toDateKey(dateCursor)
      trend.push({
        date: dateKey,
        completion_rate: trendByDate.get(dateKey) ?? 0,
      })
      dateCursor.setDate(dateCursor.getDate() + 1)
    }

    const trendEmptyReason =
      jobsTotal === 0 ? 'no_jobs' : (trendRows.length === 0 ? 'no_events' : null)

    return NextResponse.json({
      org_id: orgId,
      range_days: rangeDays,
      completion_rate: Number(Number(row?.completion_rate ?? 0).toFixed(3)),
      avg_time_to_close_hours: Number(Number(row?.avg_time_to_close_hours ?? 0).toFixed(2)),
      high_risk_jobs: Number(row?.high_risk_jobs ?? 0),
      evidence_count: Number(row?.evidence_count ?? 0),
      jobs_with_evidence: Number(row?.jobs_with_evidence ?? 0),
      jobs_without_evidence: Number(row?.jobs_without_evidence ?? 0),
      avg_time_to_first_evidence_hours: Number(Number(row?.avg_time_to_first_evidence_hours ?? 0).toFixed(2)),
      trend,
      jobs_total: Number(row?.jobs_total ?? 0),
      jobs_scored: Number(row?.jobs_scored ?? 0),
      jobs_with_any_evidence: Number(row?.jobs_with_any_evidence ?? 0),
      jobs_with_photo_evidence: Number(row?.jobs_with_photo_evidence ?? 0),
      jobs_missing_required_evidence: Number(row?.jobs_missing_required_evidence ?? 0),
      required_evidence_policy: 'Photo required for high-risk jobs',
      avg_time_to_first_photo_minutes: row?.avg_time_to_first_photo_minutes != null ? Math.round(Number(row.avg_time_to_first_photo_minutes)) : null,
      trend_empty_reason: trendEmptyReason,
    }, { status: 200, headers: { 'X-Request-ID': requestId } })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Analytics metrics error:', error)
    const rid = getRequestId(request)
    const { response, errorId } = createErrorResponse(
      'Failed to fetch analytics metrics',
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
