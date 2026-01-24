import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

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

/**
 * GET /api/subscriptions/verify?session_id=xxx
 * 
 * Verifies a Stripe checkout session and returns subscription status.
 * This is called by the thank-you page to verify the purchase.
 * 
 * Auth is optional: session_id is already a secure token, so we can verify
 * via Stripe metadata without requiring user session.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      )
    }

    // Retrieve Stripe checkout session with expanded subscription
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.latest_invoice'],
    })

    // Log session details for debugging
    console.log('[Verify] Session retrieved', {
      session_id: sessionId,
      mode: session.mode,
      payment_status: session.payment_status,
      status: session.status,
      subscription: session.subscription,
      customer: session.customer,
      metadata: session.metadata,
    })

    // Verify session is valid
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session', state: 'failed' },
        { status: 404 }
      )
    }

    // Get organization_id from session metadata (set when creating checkout)
    const organizationId = session.metadata?.organization_id || session.client_reference_id

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Session missing organization identifier', state: 'failed' },
        { status: 400 }
      )
    }

    // Optional: If user is authenticated, verify they belong to this org
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      // If user is logged in, verify they belong to the org from session
      if (userData?.organization_id && userData.organization_id !== organizationId) {
        return NextResponse.json(
          { error: 'Session does not belong to your organization', state: 'failed' },
          { status: 403 }
        )
      }
    }

    // CRITICAL: If session has a subscription and payment is complete, finalize immediately
    // Don't wait for webhooks - write to DB now
    if (session.subscription && session.payment_status === 'paid' && session.status === 'complete') {
      let subscription: Stripe.Subscription | null = null
      
      // Get subscription object (may be expanded or just an ID)
      if (typeof session.subscription === 'string') {
        try {
          subscription = await stripe.subscriptions.retrieve(session.subscription)
        } catch (err: any) {
          console.error('[Verify] Failed to retrieve subscription:', err)
        }
      } else {
        subscription = session.subscription as Stripe.Subscription
      }

      // Type guard: ensure subscription has required properties
      const hasRequiredFields = subscription && 
        subscription.id && 
        typeof (subscription as any).current_period_start === 'number' &&
        typeof (subscription as any).current_period_end === 'number'

      if (hasRequiredFields) {
        const sub = subscription as Stripe.Subscription & {
          current_period_start: number
          current_period_end: number
        }
        // Finalize immediately - write to DB from subscription object
        const planCode = session.metadata?.plan || sub.metadata?.plan || null
        
        if (planCode) {
          try {
            // Import applyPlanToOrganization from lib utils
            const { applyPlanToOrganization } = await import('@/lib/utils/applyPlan')
            
            await applyPlanToOrganization(organizationId, planCode as any, {
              stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
              stripeSubscriptionId: sub.id,
              currentPeriodStart: sub.current_period_start,
              currentPeriodEnd: sub.current_period_end,
              status: sub.status || 'active',
            })

            console.log('[Verify] Finalized subscription immediately', {
              session_id: sessionId,
              organization_id: organizationId,
              subscription_id: sub.id,
              plan_code: planCode,
            })

            return NextResponse.json({
              state: 'complete',
              status: sub.status === 'trialing' ? 'trialing' : 'active',
              plan_code: planCode,
              session_id: sessionId,
              subscription_id: sub.id,
              redirectTo: '/operations',
            })
          } catch (err: any) {
            console.error('[Verify] Failed to finalize subscription:', err)
            // Fall through to check DB
          }
        }
      }
    }

    // Check subscription status in our database
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : (session.subscription as Stripe.Subscription)?.id

    const { data: subscription } = subscriptionId ? await supabase
      .from('org_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('stripe_subscription_id', subscriptionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle() : { data: null }

    // Determine status
    let status: 'active' | 'trialing' | 'pending' | 'processing' | 'inactive' = 'inactive'
    let planCode: string | null = session.metadata?.plan || null
    let state: 'complete' | 'processing' | 'failed' = 'processing'

    // If DB has subscription, trust it
    if (subscription) {
      status = (subscription.status as any) || 'active'
      planCode = subscription.plan_code || planCode
      state = status === 'active' || status === 'trialing' ? 'complete' : 'processing'
    } else if (session.payment_status === 'paid' && session.status === 'complete' && session.subscription) {
      // Payment succeeded but subscription not yet in DB - still processing
      status = 'processing'
      state = 'processing'
    } else if (session.status === 'open') {
      status = 'pending'
      state = 'processing'
    } else {
      state = 'failed'
    }

    console.log('[Verify] Returning state', {
      session_id: sessionId,
      organization_id: organizationId,
      state,
      status,
      plan_code: planCode,
      has_subscription_in_db: !!subscription,
      session_mode: session.mode,
      session_payment_status: session.payment_status,
    })

    return NextResponse.json({
      state,
      status,
      plan_code: planCode,
      session_id: sessionId,
      payment_status: session.payment_status,
      subscription_id: subscriptionId,
      redirectTo: state === 'complete' ? '/operations' : undefined,
    })
  } catch (error: any) {
    console.error('[Verify] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify session' },
      { status: 500 }
    )
  }
}
