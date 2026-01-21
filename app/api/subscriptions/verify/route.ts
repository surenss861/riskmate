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
 */
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

    // Get user's organization_id
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData?.organization_id) {
      return NextResponse.json(
        { error: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organizationId = userData.organization_id

    // Verify session belongs to this organization
    if (session.metadata?.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Session does not belong to this organization' },
        { status: 403 }
      )
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

    // Determine status
    let status: 'active' | 'trialing' | 'pending' | 'processing' | 'inactive' = 'inactive'
    let planCode: string | null = session.metadata?.plan || null

    if (session.payment_status === 'paid' && session.status === 'complete') {
      if (subscription) {
        status = subscription.status as any
        planCode = subscription.tier || planCode
      } else {
        // Payment succeeded but subscription not yet created in DB (webhook pending)
        status = 'processing'
      }
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
