import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/me/plan
 * 
 * Returns the current user's subscription plan and entitlements.
 * This is the single source of truth for "what plan am I on and what do I get".
 */
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
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
        { error: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organizationId = userData.organization_id

    // Get plan from org_subscriptions (source of truth)
    const { data: orgSubscription, error: orgSubError } = await supabase
      .from('org_subscriptions')
      .select('plan_code, seats_limit, jobs_limit_month')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (orgSubError && orgSubError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw orgSubError
    }

    // Get subscription for billing period and Stripe info
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError && subError.code !== 'PGRST116') {
      throw subError
    }

    // Prioritize org_subscriptions.plan_code, then subscriptions.tier
    // Default to 'none' if no plan found (new users)
    const planCode = orgSubscription?.plan_code ?? subscription?.tier ?? 'none'
    const status = subscription?.status ?? 'inactive'
    const isActive = status === 'active' || status === 'trialing'

    // Calculate renewal date
    let renewalDate: string | null = null
    if (subscription?.current_period_end) {
      renewalDate = new Date(subscription.current_period_end).toISOString()
    }

    return NextResponse.json({
      plan_code: planCode,
      seats: orgSubscription?.seats_limit ?? (planCode === 'starter' ? 1 : planCode === 'pro' ? 5 : null), // null = unlimited
      jobs_limit: orgSubscription?.jobs_limit_month ?? (planCode === 'starter' ? 10 : null), // null = unlimited
      is_active: isActive,
      status,
      renewal_date: renewalDate,
      stripe_subscription_id: subscription?.stripe_subscription_id ?? null,
      current_period_start: subscription?.current_period_start ?? null,
      current_period_end: subscription?.current_period_end ?? null,
    })
  } catch (error: any) {
    console.error('[GET /api/me/plan] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get plan information' },
      { status: 500 }
    )
  }
}
