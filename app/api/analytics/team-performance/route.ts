import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { planFeatures, type PlanCode } from '@/lib/utils/planRules'

export const runtime = 'nodejs'

const ROUTE = '/api/analytics/team-performance'

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
        { period: '30d', members: [], locked: true },
        { status: 200, headers: { 'X-Request-ID': requestId } }
      )
    }

    const { searchParams } = new URL(request.url)
    const sinceParam = searchParams.get('since')
    const untilParam = searchParams.get('until')
    const customRange = parseSinceUntil(sinceParam, untilParam)
    const { days } = parsePeriod(searchParams.get('period'))
    const { since, until } = customRange ?? dateRangeForDays(days)

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
      { period: `${days}d`, members: membersWithNames },
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
