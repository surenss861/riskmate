import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { planFeatures, type PlanCode } from '@/lib/utils/planRules'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/trends'

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 } as const
type PeriodKey = keyof typeof PERIOD_DAYS

function parsePeriod(value?: string | null): { days: number; key: PeriodKey } {
  const str = value ? String(value).trim() : '30d'
  const key = (str === '7d' || str === '30d' || str === '90d' || str === '1y' ? str : '30d') as PeriodKey
  return { days: PERIOD_DAYS[key], key }
}

function parseSinceUntil(sinceParam?: string | null, untilParam?: string | null): { since: string; until: string } | null {
  const since = sinceParam?.trim() ?? ''
  const until = untilParam?.trim() ?? ''
  if (!since || !until) return null
  const sinceDate = new Date(since)
  const untilDate = new Date(until)
  if (Number.isNaN(sinceDate.getTime()) || Number.isNaN(untilDate.getTime())) return null
  return { since: sinceDate.toISOString(), until: untilDate.toISOString() }
}

function dateRangeForDays(days: number): { since: string; until: string } {
  const until = new Date()
  until.setHours(23, 59, 59, 999)
  const since = new Date(until.getTime())
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)
  return { since: since.toISOString(), until: until.toISOString() }
}

function calendarYearBounds(): { since: string; until: string } {
  const now = new Date()
  const y = now.getUTCFullYear()
  const since = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0))
  const until = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
  return { since: since.toISOString(), until: until.toISOString() }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to access analytics',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      const { response, errorId } = createErrorResponse(
        'Failed to get organization ID',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const orgId = userData.organization_id

    const { data: orgSub, error: orgSubError } = await supabase
      .from('org_subscriptions')
      .select('plan_code, status')
      .eq('organization_id', orgId)
      .maybeSingle()

    if (orgSubError && orgSubError.code !== 'PGRST116') {
      const { response, errorId } = createErrorResponse(
        'Failed to get subscription',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const planCode: PlanCode =
      orgSub?.plan_code && orgSub.plan_code !== 'none' ? (orgSub.plan_code as PlanCode) : 'none'
    const status = orgSub?.status ?? (planCode === 'none' ? 'none' : 'inactive')
    const isActive = ['active', 'trialing', 'free'].includes(status)
    const features = isActive ? planFeatures(planCode) : []
    const hasAnalytics = features.includes('analytics')

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
    const { days, key: periodKey } = parsePeriod(searchParams.get('period'))
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

    const periodLabel = periodKey === '1y' ? '1y' : `${days}d`
    const { since, until } =
      customRange ??
      (periodKey === '1y' ? calendarYearBounds() : dateRangeForDays(days))

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
      if (complianceError) throw complianceError
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
