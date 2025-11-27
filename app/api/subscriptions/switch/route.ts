import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { applyPlanToOrganization } from '@/lib/utils/applyPlan'
import { PlanCode } from '@/lib/utils/planRules'
import { trackPlanSwitchInitiated, trackPlanSwitchSuccess, trackPlanSwitchFailed } from '@/lib/utils/trackPlan'

export const runtime = 'nodejs'

function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(secretKey, {
    apiVersion: '2025-10-29.clover',
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { error: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    // Only owners and admins can switch plans
    if (!['owner', 'admin'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can change plans' },
        { status: 403 }
      )
    }

    const { plan } = await request.json()

    if (!plan || !['starter', 'pro', 'business'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      )
    }

    const organizationId = userData.organization_id
    const userId = user.id

    // Get current subscription
    const { data: currentSubscription } = await supabase
      .from('subscriptions')
      .select('tier, stripe_subscription_id, stripe_customer_id')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const currentPlan = currentSubscription?.tier || 'starter'

    // Track plan switch initiation
    await trackPlanSwitchInitiated(organizationId, userId, currentPlan, plan)

    // If switching to the same plan, return success
    if (currentPlan === plan) {
      await trackPlanSwitchSuccess(organizationId, userId, currentPlan, plan, { no_change: true })
      return NextResponse.json({
        success: true,
        message: 'Already on this plan',
        plan,
      })
    }

    // If switching to starter (free), just update the plan
    if (plan === 'starter') {
      await applyPlanToOrganization(organizationId, 'starter', {
        stripeCustomerId: currentSubscription?.stripe_customer_id || null,
        stripeSubscriptionId: null, // Cancel subscription for free plan
        currentPeriodStart: null,
        currentPeriodEnd: null,
        status: 'canceled',
      })

      // Cancel Stripe subscription if it exists
      if (currentSubscription?.stripe_subscription_id) {
        try {
          const stripe = getStripeClient()
          await stripe.subscriptions.cancel(currentSubscription.stripe_subscription_id)
          await trackPlanSwitchSuccess(organizationId, userId, currentPlan, plan, { downgrade_to_free: true })
        } catch (err: any) {
          console.warn('Failed to cancel Stripe subscription:', err)
          await trackPlanSwitchFailed(organizationId, userId, currentPlan, plan, err?.message || 'Stripe cancellation failed')
          // Continue anyway - we've updated the plan in our DB
        }
      } else {
        await trackPlanSwitchSuccess(organizationId, userId, currentPlan, plan, { downgrade_to_free_no_stripe_sub: true })
      }

      return NextResponse.json({
        success: true,
        message: 'Switched to Starter plan',
        plan: 'starter',
      })
    }

    // For paid plans (pro/business), handle upgrade/downgrade or new subscription
    const priceIdMap: Record<string, string> = {
      pro: process.env.STRIPE_PRICE_ID_PRO || '',
      business: process.env.STRIPE_PRICE_ID_BUSINESS || '',
    }

    let priceId = priceIdMap[plan]

    // If no price ID, try to get it from product ID
    if (!priceId) {
      const productIdMap: Record<string, string> = {
        pro: process.env.STRIPE_PRODUCT_ID_PRO || '',
        business: process.env.STRIPE_PRODUCT_ID_BUSINESS || '',
      }

      const productId = productIdMap[plan]

      if (productId) {
        try {
          const stripe = getStripeClient()
          const prices = await stripe.prices.list({
            product: productId,
            active: true,
            limit: 1,
          })
          if (prices.data.length > 0) {
            priceId = prices.data[0].id
          }
        } catch (err) {
          console.error(`Failed to fetch price for product ${productId}:`, err)
          await trackPlanSwitchFailed(organizationId, userId, currentPlan, plan, `Failed to fetch price for product ${productId}`)
          return NextResponse.json(
            { error: 'Failed to retrieve pricing information' },
            { status: 500 }
          )
        }
      }
    }

    if (!priceId) {
      await trackPlanSwitchFailed(organizationId, userId, currentPlan, plan, 'Stripe price ID not found')
      return NextResponse.json(
        { error: 'Stripe price ID not configured for this plan' },
        { status: 500 }
      )
    }

    // If user has an active Stripe subscription, update it
    if (currentSubscription?.stripe_subscription_id && currentPlan !== 'starter') {
      try {
        const stripe = getStripeClient()
        const subscription = await stripe.subscriptions.retrieve(
          currentSubscription.stripe_subscription_id
        )

        await stripe.subscriptions.update(currentSubscription.stripe_subscription_id, {
          items: [{
            id: subscription.items.data[0].id,
            price: priceId,
          }],
          proration_behavior: 'always_invoice', // Prorate the change
        })

        // Apply the new plan
        const updatedSubscription = await stripe.subscriptions.retrieve(
          currentSubscription.stripe_subscription_id
        ) as Stripe.Subscription

        await applyPlanToOrganization(organizationId, plan as PlanCode, {
          stripeCustomerId: currentSubscription.stripe_customer_id || null,
          stripeSubscriptionId: currentSubscription.stripe_subscription_id,
          currentPeriodStart: (updatedSubscription as any).current_period_start ?? null,
          currentPeriodEnd: (updatedSubscription as any).current_period_end ?? null,
          status: updatedSubscription.status,
        })

        await trackPlanSwitchSuccess(organizationId, userId, currentPlan, plan, { paid_plan_update: true })

        return NextResponse.json({
          success: true,
          message: `Switched to ${plan} plan`,
          plan,
        })
      } catch (err: any) {
        console.error('Failed to update subscription:', err)
        await trackPlanSwitchFailed(organizationId, userId, currentPlan, plan, err?.message || 'Stripe subscription update failed')
        // Fall through to create new checkout session if update fails
      }
    }

    // If no active subscription or update failed, create a checkout session
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://riskmate.vercel.app'}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://riskmate.vercel.app'}/dashboard/account`,
      metadata: {
        plan,
        organization_id: organizationId,
        action: 'switch',
        previous_plan: currentPlan,
      },
      client_reference_id: organizationId,
      customer: currentSubscription?.stripe_customer_id || undefined,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Plan switch error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to switch plan' },
      { status: 500 }
    )
  }
}
