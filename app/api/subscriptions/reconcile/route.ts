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
 * POST /api/subscriptions/reconcile
 * 
 * Reconciliation job to ensure Stripe ↔ Database consistency.
 * 
 * Looks for:
 * - Stripe sessions completed in last X hours without DB subscription
 * - DB subscriptions active but Stripe subscription missing/inactive
 * - Status mismatches between Stripe and DB
 * 
 * This is a "never wake up to a billing bug" safety net.
 * 
 * Should be called by:
 * - Cron job (daily/hourly)
 * - Manual admin trigger
 * - After webhook failures
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow service role or admin users
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // TODO: Add admin role check here
    // For now, allow any authenticated user (restrict in production)

    const stripe = getStripeClient()
    const hours = 24 // Look back 24 hours
    const since = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000)

    const reconciliations: Array<{
      type: string
      organization_id: string
      stripe_subscription_id: string | null
      issue: string
      fixed: boolean
    }> = []

    // 1. Find completed Stripe checkout sessions without DB subscription
    const completedSessions = await stripe.checkout.sessions.list({
      created: { gte: since },
      status: 'complete',
      limit: 100,
    })

    for (const session of completedSessions.data) {
      if (!session.subscription || !session.metadata?.organization_id) {
        continue
      }

      const organizationId = session.metadata.organization_id
      const stripeSubscriptionId = session.subscription as string

      // Check if subscription exists in DB
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .maybeSingle()

      if (!subscription) {
        reconciliations.push({
          type: 'missing_subscription',
          organization_id: organizationId,
          stripe_subscription_id: stripeSubscriptionId,
          issue: `Stripe session ${session.id} completed but no DB subscription found`,
          fixed: false, // Would need webhook handler to fix
        })
      }
    }

    // 2. Find DB subscriptions that don't match Stripe status
    const { data: dbSubscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .not('stripe_subscription_id', 'is', null)
      .limit(100)

    for (const dbSub of dbSubscriptions || []) {
      if (!dbSub.stripe_subscription_id) continue

      try {
        const stripeSub = await stripe.subscriptions.retrieve(dbSub.stripe_subscription_id)

        // Check for status mismatch
        const stripeStatus = stripeSub.status
        const dbStatus = dbSub.status

        if (stripeStatus !== dbStatus && stripeStatus !== 'active' && stripeStatus !== 'trialing') {
          reconciliations.push({
            type: 'status_mismatch',
            organization_id: dbSub.organization_id,
            stripe_subscription_id: dbSub.stripe_subscription_id,
            issue: `DB status=${dbStatus} but Stripe status=${stripeStatus}`,
            fixed: false, // Would need to update DB to match Stripe
          })
        }
      } catch (err: any) {
        if (err.code === 'resource_missing') {
          reconciliations.push({
            type: 'stripe_subscription_missing',
            organization_id: dbSub.organization_id,
            stripe_subscription_id: dbSub.stripe_subscription_id,
            issue: `DB has subscription but Stripe subscription not found`,
            fixed: false,
          })
        }
      }
    }

    console.info('[Reconcile] Completed reconciliation', {
      total_issues: reconciliations.length,
      issues: reconciliations,
    })

    return NextResponse.json({
      success: true,
      reconciliations,
      total_issues: reconciliations.length,
      message: reconciliations.length === 0
        ? 'No issues found - Stripe and DB are in sync'
        : `${reconciliations.length} issue(s) found - manual review recommended`,
    })
  } catch (error: any) {
    console.error('[Reconcile] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to reconcile subscriptions' },
      { status: 500 }
    )
  }
}
