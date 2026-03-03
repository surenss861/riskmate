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
  const bearerMatch = authHeader != null && /^\s*bearer\s+(.+)$/i.test(authHeader)
  const token = bearerMatch
    ? authHeader!.replace(/^\s*bearer\s+/i, '').trim()
    : null
  const hasBearer = token != null && token.length > 0

  if (hasBearer) {
    const result = await supabase.auth.getUser(token)
    user = result.data.user
    authError = result.error
    // Strict bearer semantics: if caller sent Authorization, do not fall back to cookie
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

  // Use admin client for DB lookups so bearer-only requests work without cookie session (RLS not bound to anon cookie)
  const admin = createSupabaseAdminClient()
  const { data: userData, error: userError } = await admin
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
      category: 'internal', severity: 'error', route,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }

  const orgId = userData.organization_id

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
  const isActive = ['active', 'trialing', 'free'].includes(status)
  const features = isActive ? planFeatures(planCode) : []
  const hasAnalytics = features.includes('analytics')

  return { orgId, requestId, hasAnalytics, isActive, status, supabase: admin }
}
