import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { planFeatures, type PlanCode } from '@/lib/utils/planRules'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/risk-heatmap'

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
        { period: '30d', buckets: [], locked: true },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

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
