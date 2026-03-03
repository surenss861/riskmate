/**
 * Shared auth + subscription check for analytics routes (trends, risk-heatmap, team-performance, mitigations).
 * Same pattern as lib/utils/organizationGuard.ts for bulk routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'
import { planFeatures, type PlanCode } from '@/lib/utils/planRules'

export type AnalyticsContext = {
  orgId: string
  requestId: string
  hasAnalytics: boolean
  isActive: boolean
  /** Subscription status for route-specific locked messages (e.g. mitigations). */
  status: string
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

  // Try Authorization header first (Bearer token), then fall back to cookie-based auth
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const result = await supabase.auth.getUser(token)
    user = result.data.user
    authError = result.error
  }
  // Whenever bearer did not yield a user (including on error), try cookie-based auth
  if (!user) {
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
      category: 'internal', severity: 'error', route,
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

  return { orgId, requestId, hasAnalytics, isActive, status }
}
