import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/account/billing
 * Returns billing/subscription information for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organization_id = userData.organization_id

    // Get plan from org_subscriptions (source of truth)
    const { data: orgSubscription } = await supabase
      .from('org_subscriptions')
      .select('plan_code, status, cancel_at_period_end, current_period_end, seats_limit, jobs_limit_month')
      .eq('organization_id', organization_id)
      .maybeSingle()

    // Get subscription for billing period and Stripe info
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('tier, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Get organization for fallback
    const { data: org } = await supabase
      .from('organizations')
      .select('subscription_tier, subscription_status')
      .eq('id', organization_id)
      .maybeSingle()

    // Count seats used
    const { count: seatsUsed } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organization_id)
      .is('archived_at', null)

    const tier = orgSubscription?.plan_code ?? subscription?.tier ?? org?.subscription_tier ?? 'none'
    const status = orgSubscription?.status ?? subscription?.status ?? org?.subscription_status ?? 'inactive'
    const cancelAtPeriodEnd = subscription?.cancel_at_period_end ?? orgSubscription?.cancel_at_period_end ?? false
    const currentPeriodEnd = subscription?.current_period_end ?? orgSubscription?.current_period_end ?? null

    return NextResponse.json({
      data: {
        tier,
        status,
        stripe_customer_id: subscription?.stripe_customer_id ?? null,
        stripe_subscription_id: subscription?.stripe_subscription_id ?? null,
        current_period_start: subscription?.current_period_start ?? null,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        renewal_date: currentPeriodEnd, // Use current_period_end as renewal date
        seats_used: seatsUsed ?? 0,
        seats_limit: orgSubscription?.seats_limit ?? null,
        jobs_limit: orgSubscription?.jobs_limit_month ?? null,
        managed_by: subscription?.stripe_subscription_id ? 'stripe' : 'internal',
      },
    })
  } catch (error: any) {
    console.error('[account/billing] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

