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
/** Cache key: userId:orgId so switching orgs or multi-org users get correct plan per org. */
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

function getCachedOrgPlan(userId: string, orgId: string): { orgId: string; planCode: PlanCode; status: string } | null {
  const key = `${userId}:${orgId}`
  const entry = orgPlanCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > ORG_PLAN_CACHE_TTL_MS) {
    orgPlanCache.delete(key)
    return null
  }
  return { orgId: entry.orgId, planCode: entry.planCode, status: entry.status }
}

function setCachedOrgPlan(userId: string, orgId: string, planCode: PlanCode, status: string): void {
  pruneExpiredOrgPlanEntries()
  evictOldestOrgPlanEntryIfNeeded()
  const key = `${userId}:${orgId}`
  orgPlanCache.set(key, { orgId, planCode, status, cachedAt: Date.now() })
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
 * Multi-org: When users.organization_id is null, org is resolved from organization_members.
 * Single membership: use that org. Multiple memberships: require explicit org selector (header or query),
 * aligned with backend auth middleware. Accept X-Organization-Id header or organization_id query.
 *
 * Auth semantics (aligned with organizationGuard for cookie clients; see JSDoc below):
 * - Only requests whose Authorization header starts with "Bearer" (case-insensitive) are treated as
 *   bearer-intent. For non-Bearer schemes (e.g. Basic) we fall back to cookie auth so web dashboard
 *   users with cookies succeed even if a non-Bearer header is present.
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
  // Treat "Bearer" (exactly) or "Bearer ..." as bearer-intent; no cookie fallback for malformed Bearer
  const isBearerIntent = hasAuthHeader && /^bearer(\s|$)/i.test(authHeader!.trim())

  if (isBearerIntent) {
    const token = authHeader!.replace(/^\s*bearer\s*/i, '').trim()
    if (!token || token.length === 0) {
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
    // No Bearer header or non-Bearer scheme: use cookie-based auth (aligns with organizationGuard)
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

  const headerOrgId = request.headers.get('x-organization-id')?.trim() || undefined
  const queryOrgId = request.nextUrl?.searchParams?.get('organization_id')?.trim() || undefined
  const requestedOrgId = headerOrgId || queryOrgId

  let orgId: string | null = null
  if (requestedOrgId) {
    // Honor explicit selector whenever provided: validate against organization_members
    const { data: memberRows, error: memberError } = await admin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('organization_id', { ascending: true })
    if (memberError || !memberRows?.length) {
      const { response, errorId } = createErrorResponse(
        'No organization assigned',
        'NO_ORGANIZATION',
        { requestId, statusCode: 403 }
      )
      logApiError(403, 'NO_ORGANIZATION', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route,
      })
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    const membership = memberRows.find((m: { organization_id: string }) => m.organization_id === requestedOrgId)
    if (!membership) {
      const { response, errorId } = createErrorResponse(
        'Organization not accessible',
        'ORGANIZATION_NOT_ACCESSIBLE',
        {
          requestId,
          statusCode: 403,
          error_hint: 'The specified organization is not one of your memberships.',
          hint: 'The specified organization is not one of your memberships.',
        }
      )
      logApiError(403, 'ORGANIZATION_NOT_ACCESSIBLE', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route,
      })
      return NextResponse.json(response, {
        status: 403,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }
    orgId = membership.organization_id
  } else {
    orgId = userData?.organization_id ?? null
    if (!orgId) {
      const { data: memberRows, error: memberError } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .order('organization_id', { ascending: true })
      if (memberError || !memberRows?.length) {
        const { response, errorId } = createErrorResponse(
          'No organization assigned',
          'NO_ORGANIZATION',
          { requestId, statusCode: 403 }
        )
        logApiError(403, 'NO_ORGANIZATION', errorId, requestId, undefined, response.message, {
          category: 'auth', severity: 'warn', route,
        })
        return NextResponse.json(response, {
          status: 403,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
      if (memberRows.length === 1) {
        orgId = memberRows[0].organization_id
      } else {
        const { response, errorId } = createErrorResponse(
          'Organization selection required',
          'ORGANIZATION_SELECTION_REQUIRED',
          {
            requestId,
            statusCode: 403,
            error_hint: 'User belongs to multiple organizations. Provide X-Organization-Id header or organization_id query parameter.',
            hint: 'User belongs to multiple organizations. Provide X-Organization-Id header or organization_id query parameter.',
          }
        )
        logApiError(403, 'ORGANIZATION_SELECTION_REQUIRED', errorId, requestId, undefined, response.message, {
          category: 'auth', severity: 'warn', route,
        })
        return NextResponse.json(response, {
          status: 403,
          headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
        })
      }
    }
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

  const cached = getCachedOrgPlan(user.id, orgId)
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
