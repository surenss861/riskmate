import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseAnalyticsClient } from '@/lib/utils/analyticsAuth'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { getAnalyticsContext } from '@/lib/utils/analyticsAuth'
import { parsePeriod, parseSinceUntil, dateRangeForDays, effectiveDaysFromRange, periodLabelFromDays } from '@/lib/utils/analyticsDateRange'
import {
  calendarYearBounds,
  PAGE_SIZE,
  MV_COVERAGE_DAYS,
  fetchAllPages,
  weekStart,
  monthStart,
  toDateKey,
} from '@/lib/utils/analyticsTrends'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/trends'

/** Cooldown for MV refresh (align with backend ensureAnalyticsMvRefreshed): at most once per hour. */
const ANALYTICS_MV_REFRESH_COOLDOWN_MS = 60 * 60 * 1000
let lastAnalyticsMvRefreshAt = 0
/** In-flight guard to prevent concurrent refreshes within the same process (avoids race when multiple requests hit simultaneously). */
let refreshInFlight = false

/**
 * Refresh analytics MVs at most once per bounded interval; skip when within cooldown or when a refresh is already in flight.
 * This is a best-effort fallback for environments without pg_cron. The primary refresh path is the backend's
 * ensureAnalyticsMvRefreshed in apps/backend/src/routes/analytics.ts; this Next.js route's refresh is only needed
 * when the dashboard is served directly without going through the Express backend.
 */
async function ensureAnalyticsMvRefreshed(supabase: SupabaseAnalyticsClient): Promise<void> {
  const now = Date.now()
  if (now - lastAnalyticsMvRefreshAt < ANALYTICS_MV_REFRESH_COOLDOWN_MS) return
  if (refreshInFlight) return
  refreshInFlight = true
  lastAnalyticsMvRefreshAt = now
  try {
    const { error } = await supabase.rpc('refresh_analytics_weekly_job_stats')
    if (error) {
      console.warn('Analytics MV refresh failed (pg_cron may be unavailable):', error)
    }
  } finally {
    refreshInFlight = false
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAnalyticsContext(request, ROUTE)
    if (ctx instanceof NextResponse) return ctx
    const { orgId, requestId, hasAnalytics, isActive, supabase } = ctx
    if (!isActive || !hasAnalytics) {
      return NextResponse.json(
        { period: '30d', groupBy: 'day', metric: 'jobs', data: [], locked: true },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }
    const { searchParams } = new URL(request.url)
    const sinceParam = searchParams.get('since')
    const untilParam = searchParams.get('until')
    const customRange = parseSinceUntil(sinceParam, untilParam)
    if (customRange && 'error' in customRange && customRange.error === 'invalid_order') {
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
    const customRangeValid = customRange && !('error' in customRange) ? customRange : null
    const parsed = parsePeriod(searchParams.get('period'))
    const { since, until } =
      customRangeValid ??
      (parsed.key === '1y' ? calendarYearBounds() : dateRangeForDays(parsed.days))
    const effectiveDays = customRangeValid ? effectiveDaysFromRange(since, until) : parsed.days
    const periodLabel = customRangeValid ? periodLabelFromDays(effectiveDays) : (parsed.key === '1y' ? '1y' : `${parsed.days}d`)

    const groupByRaw = searchParams.get('groupBy') || 'day'
    const groupBy = groupByRaw === 'month' ? 'month' : groupByRaw === 'week' ? 'week' : 'day'
    const metricRaw = searchParams.get('metric') || 'jobs'
    const metric =
      metricRaw === 'risk'
        ? 'risk'
        : metricRaw === 'compliance'
          ? 'compliance'
          : metricRaw === 'completion' || metricRaw === 'completion_rate'
            ? 'completion'
            : metricRaw === 'jobs_completed'
              ? 'jobs_completed'
              : 'jobs'

    type Point = { period: string; value: number; label: string }

    if (groupBy === 'day') {
      const { data: dayRows, error: dayError } = await supabase.rpc('get_trends_day_buckets', {
        p_org_id: orgId,
        p_since: since,
        p_until: until,
        p_metric: metric,
      })
      if (dayError) {
        console.warn('Analytics trends day buckets RPC failed, returning empty data:', dayError)
        return NextResponse.json(
          { period: periodLabel, groupBy, metric, data: [] },
          { status: 200, headers: { 'X-Request-ID': requestId } }
        )
      }
      const dayPoints: Point[] = (Array.isArray(dayRows) ? dayRows : []).map((r: { period_key: string; value: number }) => {
        const periodStr =
          typeof r.period_key === 'string' ? r.period_key.slice(0, 10) : new Date(r.period_key).toISOString().slice(0, 10)
        const raw = Number(r.value ?? 0)
        const value = metric === 'completion' ? Math.min(100, Math.max(0, raw)) : raw
        return { period: periodStr, value, label: periodStr }
      })
      return NextResponse.json(
        { period: periodLabel, groupBy, metric, data: dayPoints },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    if (metric === 'compliance' && (groupBy === 'week' || groupBy === 'month')) {
      const { data: complianceRows, error: complianceError } = await supabase.rpc(
        'get_trends_compliance_buckets',
        {
          p_org_id: orgId,
          p_since: since,
          p_until: until,
          p_group_by: groupBy,
        }
      )
      if (complianceError) {
        console.warn('get_trends_compliance_buckets RPC failed, returning empty data:', complianceError)
        return NextResponse.json(
          { period: periodLabel, groupBy, metric, data: [] },
          { status: 200, headers: { 'X-Request-ID': requestId } }
        )
      }
      const compPoints: Point[] = (Array.isArray(complianceRows) ? complianceRows : []).map(
        (r: {
          period_key: string
          total: number
          with_signature: number
          with_photo: number
          checklist_complete: number
        }) => {
          const total = Number(r.total ?? 0)
          const sigRate = total === 0 ? 0 : Number(r.with_signature ?? 0) / total
          const photoRate = total === 0 ? 0 : Number(r.with_photo ?? 0) / total
          const checklistRate = total === 0 ? 0 : Number(r.checklist_complete ?? 0) / total
          const valuePct =
            total === 0 ? 0 : Math.round(((sigRate + photoRate + checklistRate) / 3) * 10000) / 100
          const periodStr =
            typeof r.period_key === 'string'
              ? r.period_key.slice(0, 10)
              : new Date(r.period_key).toISOString().slice(0, 10)
          return { period: periodStr, value: valuePct, label: periodStr }
        }
      )
      return NextResponse.json(
        { period: periodLabel, groupBy, metric, data: compPoints },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    // Week/month: use MV path for jobs, risk, completion, jobs_completed (same strategy as backend)
    const useMv =
      (groupBy === 'week' || groupBy === 'month') &&
      effectiveDays <= MV_COVERAGE_DAYS &&
      (metric === 'jobs' || metric === 'risk' || metric === 'completion' || metric === 'jobs_completed')

    if (useMv) {
      await ensureAnalyticsMvRefreshed(supabase)
      const sinceWeek = weekStart(new Date(since))
      const untilWeek = weekStart(new Date(until))
      const points: Point[] = []

      if (metric === 'completion') {
        const [completionRes, creationRes] = await Promise.all([
          fetchAllPages<{ week_start: string; jobs_completed: number }>(async (offset, limit) => {
            const { data, error } = await supabase
              .from('analytics_weekly_completion_stats')
              .select('week_start, jobs_completed')
              .eq('organization_id', orgId)
              .gte('week_start', sinceWeek)
              .lte('week_start', untilWeek)
              .order('week_start', { ascending: true })
              .range(offset, offset + limit - 1)
            return { data, error }
          }),
          fetchAllPages<{ week_start: string; jobs_created: number }>(async (offset, limit) => {
            const { data, error } = await supabase
              .from('analytics_weekly_job_stats')
              .select('week_start, jobs_created')
              .eq('organization_id', orgId)
              .gte('week_start', sinceWeek)
              .lte('week_start', untilWeek)
              .order('week_start', { ascending: true })
              .range(offset, offset + limit - 1)
            return { data, error }
          }),
        ])
        if (!completionRes.error && !creationRes.error) {
          const completionRows = (completionRes.data ?? []) as { week_start: string; jobs_completed: number }[]
          const creationRows = (creationRes.data ?? []) as { week_start: string; jobs_created: number }[]
          const createdByWeek = new Map<string, number>()
          const completedByWeek = new Map<string, number>()
          for (const r of creationRows) {
            const w = typeof r.week_start === 'string' ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10)
            createdByWeek.set(w, (createdByWeek.get(w) ?? 0) + Number(r.jobs_created ?? 0))
          }
          for (const r of completionRows) {
            const w = typeof r.week_start === 'string' ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10)
            completedByWeek.set(w, (completedByWeek.get(w) ?? 0) + Number(r.jobs_completed ?? 0))
          }
          if (groupBy === 'week') {
            const allWeeks = [...new Set([...createdByWeek.keys(), ...completedByWeek.keys()])].sort()
            for (const period of allWeeks) {
              const created = createdByWeek.get(period) ?? 0
              const completed = completedByWeek.get(period) ?? 0
              const ratePct = created === 0 ? 0 : (completed / created) * 100
              const value = Math.min(100, Math.max(0, Math.round(ratePct * 100) / 100))
              points.push({ period, value, label: period })
            }
          } else {
            const byMonth = new Map<string, { created: number; completed: number }>()
            for (const r of completionRows) {
              const period = monthStart(new Date(typeof r.week_start === 'string' ? r.week_start : String(r.week_start)))
              const cur = byMonth.get(period) ?? { created: 0, completed: 0 }
              cur.completed += Number(r.jobs_completed ?? 0)
              byMonth.set(period, cur)
            }
            for (const r of creationRows) {
              const period = monthStart(new Date(typeof r.week_start === 'string' ? r.week_start : String(r.week_start)))
              const cur = byMonth.get(period) ?? { created: 0, completed: 0 }
              cur.created += Number(r.jobs_created ?? 0)
              byMonth.set(period, cur)
            }
            for (const [period] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
              const { created, completed } = byMonth.get(period)!
              const ratePct = created === 0 ? 0 : (completed / created) * 100
              const value = Math.min(100, Math.max(0, Math.round(ratePct * 100) / 100))
              points.push({ period, value, label: period })
            }
          }
          if (points.length > 0) {
            return NextResponse.json(
              { period: periodLabel, groupBy, metric, data: points },
              { status: 200, headers: { 'X-Request-ID': requestId } }
            )
          }
        }
        if (completionRes.error) throw completionRes.error
        if (creationRes.error) throw creationRes.error
      }

      if (metric === 'jobs_completed') {
        const completionRes = await fetchAllPages<{ week_start: string; jobs_completed: number }>(
          async (offset, limit) => {
            const { data, error } = await supabase
              .from('analytics_weekly_completion_stats')
              .select('week_start, jobs_completed')
              .eq('organization_id', orgId)
              .gte('week_start', sinceWeek)
              .lte('week_start', untilWeek)
              .order('week_start', { ascending: true })
              .range(offset, offset + limit - 1)
            return { data, error }
          }
        )
        if (!completionRes.error && completionRes.data) {
          const completionRows = completionRes.data as { week_start: string; jobs_completed: number }[]
          const completedByWeek = new Map<string, number>()
          for (const r of completionRows) {
            const w = typeof r.week_start === 'string' ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10)
            completedByWeek.set(w, (completedByWeek.get(w) ?? 0) + Number(r.jobs_completed ?? 0))
          }
          if (groupBy === 'week') {
            const allWeeks = [...completedByWeek.keys()].sort()
            for (const period of allWeeks) {
              points.push({ period, value: completedByWeek.get(period) ?? 0, label: period })
            }
          } else {
            const byMonth = new Map<string, number>()
            for (const r of completionRows) {
              const period = monthStart(new Date(typeof r.week_start === 'string' ? r.week_start : String(r.week_start)))
              byMonth.set(period, (byMonth.get(period) ?? 0) + Number(r.jobs_completed ?? 0))
            }
            for (const period of [...byMonth.keys()].sort((a, b) => a.localeCompare(b))) {
              points.push({ period, value: byMonth.get(period) ?? 0, label: period })
            }
          }
          if (points.length > 0) {
            return NextResponse.json(
              { period: periodLabel, groupBy, metric, data: points },
              { status: 200, headers: { 'X-Request-ID': requestId } }
            )
          }
        }
        if (completionRes.error) throw completionRes.error
      }

      const { data: mvRows, error: mvError } = await fetchAllPages<{
        week_start: string
        jobs_created: number
        avg_risk: number | null
      }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from('analytics_weekly_job_stats')
          .select('week_start, jobs_created, avg_risk')
          .eq('organization_id', orgId)
          .gte('week_start', sinceWeek)
          .lte('week_start', untilWeek)
          .order('week_start', { ascending: true })
          .range(offset, offset + limit - 1)
        return { data, error }
      })

      if (!mvError && mvRows && mvRows.length > 0 && (metric === 'jobs' || metric === 'risk')) {
        const rows = mvRows as { week_start: string; jobs_created: number; avg_risk: number | null }[]
        if (groupBy === 'week') {
          for (const r of rows) {
            const period =
              typeof r.week_start === 'string' ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10)
            let value = 0
            if (metric === 'jobs') value = r.jobs_created ?? 0
            else if (metric === 'risk') value = r.avg_risk != null ? Math.round(r.avg_risk * 100) / 100 : 0
            points.push({ period, value, label: period })
          }
        } else {
          const byMonth = new Map<string, { jobs_created: number; riskSum: number; riskWeight: number }>()
          for (const r of rows) {
            const period = monthStart(new Date(typeof r.week_start === 'string' ? r.week_start : String(r.week_start)))
            const cur = byMonth.get(period) ?? { jobs_created: 0, riskSum: 0, riskWeight: 0 }
            cur.jobs_created += r.jobs_created ?? 0
            if (r.avg_risk != null && (r.jobs_created ?? 0) > 0) {
              cur.riskSum += (r.avg_risk ?? 0) * (r.jobs_created ?? 0)
              cur.riskWeight += r.jobs_created ?? 0
            }
            byMonth.set(period, cur)
          }
          for (const [period] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const cur = byMonth.get(period)!
            let value = 0
            if (metric === 'jobs') value = cur.jobs_created
            else if (metric === 'risk')
              value = cur.riskWeight === 0 ? 0 : Math.round((cur.riskSum / cur.riskWeight) * 100) / 100
            points.push({ period, value, label: period })
          }
        }
        return NextResponse.json(
          { period: periodLabel, groupBy, metric, data: points },
          { status: 200, headers: { 'X-Request-ID': requestId } }
        )
      }
    }

    // Fallback: week/month when MV unavailable or out of range — bucket jobs in memory (same as backend)
    if ((groupBy === 'week' || groupBy === 'month') && (metric === 'jobs' || metric === 'risk' || metric === 'completion' || metric === 'jobs_completed')) {
      const getBucketKey = (date: Date) =>
        groupBy === 'month' ? monthStart(date) : groupBy === 'week' ? weekStart(date) : toDateKey(date.toISOString())

      if (metric === 'jobs_completed') {
        const { data: completedJobs, error: completedError } = await fetchAllPages<{
          id: string
          completed_at: string | null
        }>(async (offset, limit) => {
          const { data, error } = await supabase
            .from('jobs')
            .select('id, completed_at')
            .eq('organization_id', orgId)
            .is('deleted_at', null)
            .not('completed_at', 'is', null)
            .gte('completed_at', since)
            .lte('completed_at', until)
            .order('completed_at', { ascending: false })
            .range(offset, offset + limit - 1)
          return { data, error }
        })
        if (!completedError && completedJobs) {
          const bucketCompletedByDate = new Map<string, number>()
          for (const j of completedJobs as { id: string; completed_at: string | null }[]) {
            if (j.completed_at) {
              const key = getBucketKey(new Date(j.completed_at))
              bucketCompletedByDate.set(key, (bucketCompletedByDate.get(key) ?? 0) + 1)
            }
          }
          const points: Point[] = []
          for (const period of [...bucketCompletedByDate.keys()].sort((a, b) => a.localeCompare(b))) {
            points.push({ period, value: bucketCompletedByDate.get(period) ?? 0, label: period })
          }
          return NextResponse.json(
            { period: periodLabel, groupBy, metric, data: points },
            { status: 200, headers: { 'X-Request-ID': requestId } }
          )
        }
        if (completedError) throw completedError
      }

      const { data: jobs, error: jobsError } = await fetchAllPages<{
        id: string
        risk_score: number | null
        status: string | null
        created_at: string
        completed_at: string | null
      }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, risk_score, status, created_at, completed_at')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .gte('created_at', since)
          .lte('created_at', until)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
        return { data, error }
      })

      if (jobsError) throw jobsError
      const jobList = (jobs ?? []) as {
        id: string
        risk_score: number | null
        status: string | null
        created_at: string
        completed_at: string | null
      }[]

      const bucketValues = new Map<string, number>()
      const bucketRiskSums = new Map<string, { sum: number; count: number }>()
      const bucketCompleted = new Map<string, number>()
      const points: Point[] = []

      for (const j of jobList) {
        const keyCreated = getBucketKey(new Date(j.created_at))
        const completed =
          j.status?.toLowerCase() === 'completed' &&
          j.completed_at != null &&
          j.completed_at >= since &&
          j.completed_at <= until

        if (metric === 'completion') {
          bucketValues.set(keyCreated, (bucketValues.get(keyCreated) ?? 0) + 1)
          if (completed) {
            bucketCompleted.set(keyCreated, (bucketCompleted.get(keyCreated) ?? 0) + 1)
          }
        } else if (metric === 'jobs') {
          bucketValues.set(keyCreated, (bucketValues.get(keyCreated) ?? 0) + 1)
        } else if (metric === 'risk' && j.risk_score != null) {
          const cur = bucketRiskSums.get(keyCreated) ?? { sum: 0, count: 0 }
          cur.sum += j.risk_score
          cur.count += 1
          bucketRiskSums.set(keyCreated, cur)
        }
      }

      if (metric === 'completion') {
        for (const period of [...bucketValues.keys()].sort((a, b) => a.localeCompare(b))) {
          const created = bucketValues.get(period) ?? 0
          const completed = bucketCompleted.get(period) ?? 0
          const rate = created === 0 ? 0 : (completed / created) * 100
          const value = Math.min(100, Math.max(0, Math.round(rate * 100) / 100))
          points.push({ period, value, label: period })
        }
      } else if (metric === 'jobs') {
        for (const [period] of [...bucketValues.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          points.push({ period, value: bucketValues.get(period) ?? 0, label: period })
        }
      } else if (metric === 'risk') {
        for (const [period] of [...bucketRiskSums.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          const { sum, count } = bucketRiskSums.get(period)!
          const value = count === 0 ? 0 : Math.round((sum / count) * 100) / 100
          points.push({ period, value, label: period })
        }
      }

      return NextResponse.json(
        { period: periodLabel, groupBy, metric, data: points },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    return NextResponse.json(
      { period: periodLabel, groupBy, metric, data: [] },
      { status: 200, headers: { 'X-Request-ID': requestId } }
    )
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('Analytics trends error:', error)
    const rid = getRequestId(request)
    const { response, errorId } = createErrorResponse(
      'Failed to fetch analytics trends',
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
