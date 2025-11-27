import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { applyPlanToOrganization } from '@/lib/utils/applyPlan'
import { PlanCode } from '@/lib/utils/planRules'
import { trackPlanSwitchSuccess } from '@/lib/utils/trackPlan'

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
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { session_id } = await request.json()

    if (!session_id) {
      return NextResponse.json(
        { message: 'Missing session_id' },
        { status: 400 }
      )
    }

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    })

    if (!session) {
      return NextResponse.json(
        { message: 'Checkout session not found' },
        { status: 404 }
      )
    }

    const metadata = session.metadata || {}
    const planCode = (metadata.plan_code || metadata.plan) as PlanCode | undefined
    const organizationId =
      metadata.organization_id ||
      session.client_reference_id ||
      (typeof session.subscription === 'object'
        ? session.subscription?.metadata?.organization_id
        : undefined)

    if (!planCode || !['starter', 'pro', 'business'].includes(planCode)) {
      return NextResponse.json(
        { message: 'Session missing plan information' },
        { status: 400 }
      )
    }

    let finalOrgId = organizationId
    if (!finalOrgId) {
      // Try to get from user's organization
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!userData?.organization_id) {
        return NextResponse.json(
          { message: 'Session missing organization identifier' },
          { status: 400 }
        )
      }

      // Use user's organization if not in session
      finalOrgId = userData.organization_id
    }

    // Verify organization belongs to user
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get user organization' },
        { status: 500 }
      )
    }

    if (userData.organization_id !== finalOrgId) {
      return NextResponse.json(
        { message: 'Session does not belong to this organization' },
        { status: 403 }
      )
    }

    // Ensure finalOrgId is defined (TypeScript guard)
    if (!finalOrgId) {
      return NextResponse.json(
        { message: 'Organization identifier is missing' },
        { status: 400 }
      )
    }

    const subscription =
      typeof session.subscription === 'object'
        ? session.subscription
        : session.subscription
        ? await stripe.subscriptions.retrieve(session.subscription)
        : null

    // Get previous plan before switching
    const { data: prevSubscription } = await supabase
      .from('subscriptions')
      .select('tier')
      .eq('organization_id', finalOrgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    const previousPlan = prevSubscription?.tier || null

    await applyPlanToOrganization(finalOrgId, planCode, {
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      stripeSubscriptionId:
        typeof session.subscription === 'string'
          ? session.subscription
          : subscription?.id ?? null,
      currentPeriodStart: subscription
        ? (subscription as any).current_period_start ?? null
        : null,
      currentPeriodEnd: subscription
        ? (subscription as any).current_period_end ?? null
        : null,
      status: subscription?.status,
    })

    // Track successful plan switch from checkout
    await trackPlanSwitchSuccess(finalOrgId, user.id, previousPlan, planCode, {
      from_checkout: true,
      session_id: session_id,
    })

    return NextResponse.json({
      status: 'updated',
      plan: planCode,
      organization_id: finalOrgId,
    })
  } catch (error: any) {
    console.error('Checkout confirmation failed:', error)
    return NextResponse.json(
      { message: 'Failed to confirm subscription', detail: error?.message },
      { status: 500 }
    )
  }
}
