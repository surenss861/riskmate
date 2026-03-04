/**
 * Shared auth + subscription check for analytics routes (trends, risk-heatmap, team-performance, mitigations).
 * Same pattern as lib/utils/organizationGuard.ts for bulk routes.
 * Bearer-only requests are supported: after resolving user.id, DB lookups use admin client so RLS does not depend on cookie session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { planFeatures, type PlanCode } from '@/lib/utils/planRules'

const ORG_PLAN_CACHE_TTL_MS = 60_000
const ORG_PLAN_CACHE_MAX_ENTRIES =
  typeof process !== 'undefined' && process.env?.ORG_PLAN_CACHE_MAX_ENTRIES != null
    ? Math.max(1, parseInt(process.env.ORG_PLAN_CACHE_MAX_ENTRIES, 10) || 1000)
    : 1000
const orgPlanCache = new Map<
  string,
  { orgId: string; planCode: PlanCode; status: string; cachedAt: number }
>()

function pruneExpiredOrgPlanEntries(): void {
  const now = Date.now()
  for (const [key, entry] of orgPlanCache.entries()) {
    if (now - entry.cachedAt > ORG_PLAN_CACHE_TTL_MS) orgPlanCache.delete(key)
  }
}

function evictOldestOrgPlanEntryIfNeeded(): void {
  if (orgPlanCache.size < ORG_PLAN_CACHE_MAX_ENTRIES) return
  let oldestKey: string | null = null
  let oldestAt = Infinity
  for (const [key, entry] of orgPlanCache.entries()) {
    if (entry.cachedAt < oldestAt) {
      oldestAt = entry.cachedAt
      oldestKey = key
    }
  }
  if (oldestKey !== null) orgPlanCache.delete(oldestKey)
}

function getCachedOrgPlan(userId: string): { orgId: string; planCode: PlanCode; status: string } | null {
  const entry = orgPlanCache.get(userId)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > ORG_PLAN_CACHE_TTL_MS) {
    orgPlanCache.delete(userId)
    return null
  }
  return { orgId: entry.orgId, planCode: entry.planCode, status: entry.status }
}

function setCachedOrgPlan(userId: string, orgId: string, planCode: PlanCode, status: string): void {
  pruneExpiredOrgPlanEntries()
  evictOldestOrgPlanEntryIfNeeded()
  orgPlanCache.set(userId, { orgId, planCode, status, cachedAt: Date.now() })
}

/** Exposed for unit tests: current cache size. */
export function getOrgPlanCacheSizeForTesting(): number {
  return orgPlanCache.size
}

/** Test-only: clear org-plan cache so tests can isolate cache effects (e.g. membership fallback). */
export function resetOrgPlanCacheForTesting(): void {
  orgPlanCache.clear()
}

export type SupabaseAnalyticsClient = ReturnType<typeof createSupabaseAdminClient>

export type AnalyticsContext = {
  orgId: string
  requestId: string
  hasAnalytics: boolean
  isActive: boolean
  /** Subscription status for route-specific locked messages (e.g. mitigations). */
  status: string
  /** Client for data/RPC queries. Admin client so bearer-only requests work without cookie session; org scoping is explicit in RPC params. */
  supabase: SupabaseAnalyticsClient
}

/**
 * Resolve auth, org, subscription and plan features for analytics routes.
 * Returns context with orgId, requestId, hasAnalytics, isActive, or a NextResponse on auth/query error.
 * Routes should then check !isActive || !hasAnalytics and return their own locked response body if needed.
 *
 * Auth semantics (stricter than organizationGuard.ts):
 * - If the request has *any* non-empty Authorization header, we treat it as bearer-intent and do **not**
 *   fall back to cookie auth. Non-Bearer schemes (e.g. Basic, Digest) result in 401 without trying cookies.
 *   Rationale: analytics is often called by API clients with Bearer; allowing cookie fallback when a
 *   non-Bearer header is present would be inconsistent and could surprise consumers. Other app routes
 *   use organizationGuard, which falls back to cookies when the header is absent or when Bearer
 *   parsing fails; analytics routes intentionally use bearer-only when any Authorization header exists.
 */
export async function getAnalyticsContext(
  request: NextRequest,
  route: string
): Promise<AnalyticsContext | NextResponse> {
  const requestId = getRequestId(request)

  const supabase = await createSupabaseServerClient()
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  let authError: Awaited<ReturnType<typeof supabase.auth.getUser>>['error'] = null

  const authHeader = request.headers.get('authorization')
  const hasAuthHeader = authHeader != null && authHeader.trim().length > 0

  if (hasAuthHeader) {
    // Any present Authorization header is bearer-intent: never fall back to cookie.
    const bearerMatch = /^\s*bearer\s+(.+)$/i.test(authHeader!)
    const token = bearerMatch ? authHeader!.replace(/^\s*bearer\s+/i, '').trim() : null
    const hasValidBearer = token != null && token.length > 0
    if (!hasValidBearer) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to access analytics',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const result = await supabase.auth.getUser(token)
    user = result.data.user
    authError = result.error
    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to access analytics',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
  } else {
    // No Authorization header: use cookie-based auth
    const result = await supabase.auth.getUser()
    user = result.data.user
    authError = result.error
  }

  if (authError || !user) {
    const { response, errorId } = createErrorResponse(
      'Unauthorized: Please log in to access analytics',
      'UNAUTHORIZED',
      { requestId, statusCode: 401 }
    )
    logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
      category: 'auth', severity: 'warn', route,
    })
    return NextResponse.json(response, {
      status: 401,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }

  const admin = createSupabaseAdminClient()

  const cached = getCachedOrgPlan(user.id)
  if (cached) {
    const isActive = ['active', 'trialing', 'free'].includes(cached.status)
    const features = isActive ? planFeatures(cached.planCode) : []
    const hasAnalytics = features.includes('analytics')
    return {
      orgId: cached.orgId,
      requestId,
      hasAnalytics,
      isActive,
      status: cached.status,
      supabase: admin,
    }
  }

  const { data: userData, error: userError } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (userError) {
    const { response, errorId } = createErrorResponse(
      'Failed to get organization ID',
      'QUERY_ERROR',
      { requestId, statusCode: 500 }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal', severity: 'error', route,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }

  let orgId: string | null = userData?.organization_id ?? null
  if (!orgId) {
    const { data: memberRows, error: memberError } = await admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('organization_id', { ascending: true })
      .limit(1)
    if (memberError || !memberRows?.length) {
      const { response, errorId } = createErrorResponse(
        'Failed to get organization ID',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
        category: 'internal', severity: 'error', route,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    orgId = memberRows[0].organization_id
  }

  if (!orgId) {
    const { response, errorId } = createErrorResponse(
      'Failed to get organization ID',
      'QUERY_ERROR',
      { requestId, statusCode: 500 }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal', severity: 'error', route,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }

  const { data: orgSub, error: orgSubError } = await admin
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
      category: 'internal', severity: 'error', route,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }

  const planCode: PlanCode =
    orgSub?.plan_code && orgSub.plan_code !== 'none' ? (orgSub.plan_code as PlanCode) : 'none'
  const status = orgSub?.status ?? (planCode === 'none' ? 'none' : 'inactive')
  setCachedOrgPlan(user.id, orgId, planCode, status)
  const isActive = ['active', 'trialing', 'free'].includes(status)
  const features = isActive ? planFeatures(planCode) : []
  const hasAnalytics = features.includes('analytics')

  return { orgId, requestId, hasAnalytics, isActive, status, supabase: admin }
}
