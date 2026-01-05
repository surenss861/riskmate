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

    // Get user's subscription (if using subscriptions table)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Return subscription data or default free plan
    return NextResponse.json({
      plan: subscription?.plan_name || 'Free',
      status: subscription?.status || 'active',
      renewal_date: subscription?.renewal_date || null,
      portal_url: subscription?.portal_url || null,
      ...(subscription ? {
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
      } : {}),
    })
  } catch (error: any) {
    console.error('[account/billing] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

