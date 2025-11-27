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
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { error: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const { plan, success_url, cancel_url } = await request.json()

    if (!plan || !['starter', 'pro', 'business'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      )
    }

    // Map plan names to Stripe price IDs
    const priceIdMap: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_ID_STARTER || '',
      pro: process.env.STRIPE_PRICE_ID_PRO || '',
      business: process.env.STRIPE_PRICE_ID_BUSINESS || '',
    }

    const priceId = priceIdMap[plan]

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price ID not configured for plan: ${plan}` },
        { status: 500 }
      )
    }

    const stripe = getStripeClient()
    const organizationId = userData.organization_id

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: success_url || `${process.env.NEXT_PUBLIC_APP_URL || 'https://riskmate.vercel.app'}/pricing/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_APP_URL || 'https://riskmate.vercel.app'}/pricing`,
      metadata: {
        plan,
        organization_id: organizationId,
      },
      client_reference_id: organizationId,
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

