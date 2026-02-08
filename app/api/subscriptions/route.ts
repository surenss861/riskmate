import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/subscriptions'

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to view subscription',
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

    // Get user's organization_id
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
      logApiError(500, 'QUERY_ERROR', errorId, requestId, userData?.organization_id, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    const organization_id = userData.organization_id

    // Get plan from org_subscriptions (source of truth)
    const { data: orgSubscription, error: orgSubError } = await supabase
      .from('org_subscriptions')
      .select('plan_code, seats_limit, jobs_limit_month, cancel_at_period_end')
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (orgSubError && orgSubError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw orgSubError
    }

    // Get subscription for billing period and Stripe info
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*, cancel_at_period_end')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    // Get cancel_at_period_end from subscription or org_subscriptions
    const cancelAtPeriodEnd = subscription?.cancel_at_period_end ?? orgSubscription?.cancel_at_period_end ?? false

    if (subError && subError.code !== 'PGRST116') {
      throw subError
    }

    // Load organization record for fallback metadata
    const { data: org } = await supabase
      .from('organizations')
      .select('subscription_tier, subscription_status')
      .eq('id', organization_id)
      .maybeSingle()

    // Prioritize org_subscriptions.plan_code, then subscriptions.tier, then organizations.subscription_tier
    let tier = orgSubscription?.plan_code ?? subscription?.tier ?? org?.subscription_tier ?? null
    let status = subscription?.status ?? org?.subscription_status ?? (tier ? 'active' : 'none')

    const normalizedStatus = status ?? (tier ? 'active' : 'none')
    
    // Use actual limits from org_subscriptions if available, otherwise calculate from tier
    let jobsLimit: number | null = null
    if (orgSubscription) {
      jobsLimit = orgSubscription.jobs_limit_month ?? null
    } else {
      // Fallback to tier-based limits
      jobsLimit =
        tier === 'starter'
          ? 10
          : tier === 'pro'
          ? null // unlimited
          : tier === 'business'
          ? null // unlimited
          : normalizedStatus === 'none'
          ? 0
          : null
    }

    // Count jobs created in current billing period
    const periodStart = subscription?.current_period_start
      ? new Date(subscription.current_period_start)
      : new Date() // If no subscription, use current month

    const { count, error: countError } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .gte('created_at', periodStart.toISOString())

    if (countError) throw countError

    // Show usage if there's a tier (plan), otherwise null
    const usage = tier ? (count ?? 0) : null
    const resetDate = tier ? subscription?.current_period_end || null : null

    return NextResponse.json({
      data: {
        id: subscription?.id,
        organization_id,
        tier,
        status: normalizedStatus,
        current_period_start: subscription?.current_period_start || null,
        current_period_end: subscription?.current_period_end || null,
        cancel_at_period_end: cancelAtPeriodEnd,
        stripe_subscription_id: subscription?.stripe_subscription_id || null,
        stripe_customer_id: subscription?.stripe_customer_id || null,
        usage,
        jobsLimit,
        resetDate,
      },
    })
  } catch (error: any) {
    console.error('Subscription fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

