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

    const stripe = getStripeClient()

    // Try to get price ID from environment variable first
    const priceIdMap: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_ID_STARTER || '',
      pro: process.env.STRIPE_PRICE_ID_PRO || '',
      business: process.env.STRIPE_PRICE_ID_BUSINESS || '',
    }

    let priceId = priceIdMap[plan]

    // If no price ID, try to get it from product ID
    if (!priceId) {
      const productIdMap: Record<string, string> = {
        starter: process.env.STRIPE_PRODUCT_ID_STARTER || '',
        pro: process.env.STRIPE_PRODUCT_ID_PRO || '',
        business: process.env.STRIPE_PRODUCT_ID_BUSINESS || '',
      }

      const productId = productIdMap[plan]
      
      if (productId) {
        try {
          // Fetch the product and get its default price
          const product = await stripe.products.retrieve(productId)
          const prices = await stripe.prices.list({
            product: productId,
            active: true,
            limit: 1,
          })
          
          if (prices.data.length > 0) {
            priceId = prices.data[0].id
          } else {
            return NextResponse.json(
              { error: `No active price found for product: ${productId}` },
              { status: 500 }
            )
          }
        } catch (err: any) {
          console.error('Failed to fetch product price:', err)
          return NextResponse.json(
            { error: `Failed to get price for product ${productId}: ${err.message}` },
            { status: 500 }
          )
        }
      }
    }

    if (!priceId) {
      return NextResponse.json(
        { error: `Stripe price ID or product ID not configured for plan: ${plan}. Please set STRIPE_PRICE_ID_${plan.toUpperCase()} or STRIPE_PRODUCT_ID_${plan.toUpperCase()}` },
        { status: 500 }
      )
    }

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

