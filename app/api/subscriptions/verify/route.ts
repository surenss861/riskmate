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

    // Retrieve Stripe checkout session
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    // Verify session is valid and paid
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 404 }
      )
    }

    // Get organization_id from session metadata (set when creating checkout)
    const organizationId = session.metadata?.organization_id || session.client_reference_id

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Session missing organization identifier' },
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
          { error: 'Session does not belong to your organization' },
          { status: 403 }
        )
      }
    }

    // Check subscription status in our database
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('stripe_subscription_id', session.subscription as string)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Determine status - CRITICAL: Prefer DB over Stripe to never lock out customers
    let status: 'active' | 'trialing' | 'pending' | 'processing' | 'inactive' = 'inactive'
    let planCode: string | null = session.metadata?.plan || null

    // If DB has subscription, trust it (even if Stripe is missing/lagging)
    if (subscription) {
      status = subscription.status as any
      planCode = subscription.tier || planCode
      
      // If DB says active but Stripe session isn't complete, log mismatch but trust DB
      if (status === 'active' && session.status !== 'complete') {
        console.warn('[Verify] Billing mismatch: DB active but Stripe incomplete', {
          session_id: sessionId,
          organization_id: organizationId,
          db_status: status,
          stripe_status: session.status,
          payment_status: session.payment_status,
        })
        // Still return active - never lock out customer due to Stripe lag
      }
    } else if (session.payment_status === 'paid' && session.status === 'complete') {
      // Payment succeeded but subscription not yet created in DB (webhook pending)
      status = 'processing'
    } else if (session.status === 'open') {
      status = 'pending'
    }

    console.info('[Verify] Session verified', {
      session_id: sessionId,
      organization_id: organizationId,
      status,
      plan_code: planCode,
      has_subscription_in_db: !!subscription,
    })

    return NextResponse.json({
      status,
      plan_code: planCode,
      session_id: sessionId,
      payment_status: session.payment_status,
      subscription_id: session.subscription,
    })
  } catch (error: any) {
    console.error('[Verify] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to verify session' },
      { status: 500 }
    )
  }
}
