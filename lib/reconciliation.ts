/**
 * Subscription Reconciliation
 * 
 * Prevents drift between Stripe and database by:
 * 1. Periodically syncing subscription state from Stripe
 * 2. Detecting and repairing mismatches
 * 
 * Run this as a daily/weekly cron job.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { applyPlanToOrganization } from '@/apps/backend/src/routes/stripeWebhook'

const stripeFactory = (): any => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY')
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY)
}

/**
 * Reconcile a single organization's subscription
 * 
 * Fetches current state from Stripe and updates database if mismatch detected.
 */
export async function reconcileOrganizationSubscription(
  organizationId: string,
  stripeSubscriptionId: string
): Promise<{
  matched: boolean
  repaired: boolean
  details: {
    stripeStatus?: string
    dbStatus?: string
    stripeTier?: string
    dbTier?: string
  }
}> {
  const supabase = await createSupabaseServerClient()
  const stripe = stripeFactory()

  try {
    // Fetch from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    
    // Fetch from database
    const { data: dbSubscription } = await supabase
      .from('subscriptions')
      .select('tier, status, stripe_subscription_id')
      .eq('organization_id', organizationId)
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Extract plan from metadata
    const planCode = stripeSubscription.metadata?.plan_code as string | undefined
    if (!planCode || !['starter', 'pro', 'business'].includes(planCode)) {
      return {
        matched: false,
        repaired: false,
        details: {
          stripeStatus: stripeSubscription.status,
          dbStatus: dbSubscription?.status,
        },
      }
    }

    // Normalize Stripe status
    let normalizedStatus = 'active'
    if (stripeSubscription.status === 'past_due' || stripeSubscription.status === 'unpaid') {
      normalizedStatus = 'past_due'
    } else if (stripeSubscription.status === 'canceled' || stripeSubscription.status === 'cancelled') {
      normalizedStatus = 'canceled'
    } else if (stripeSubscription.status === 'trialing') {
      normalizedStatus = 'trialing'
    }

    // Check for mismatches
    const statusMatch = dbSubscription?.status === normalizedStatus
    const tierMatch = dbSubscription?.tier === planCode

    if (statusMatch && tierMatch) {
      return {
        matched: true,
        repaired: false,
        details: {
          stripeStatus: normalizedStatus,
          dbStatus: dbSubscription.status,
          stripeTier: planCode,
          dbTier: dbSubscription.tier,
        },
      }
    }

    // Mismatch detected - repair
    console.warn(`Subscription mismatch detected for org ${organizationId}:`, {
      stripe: { tier: planCode, status: normalizedStatus },
      db: { tier: dbSubscription?.tier, status: dbSubscription?.status },
    })

    await applyPlanToOrganization(
      organizationId,
      planCode as any,
      {
        stripeCustomerId: typeof stripeSubscription.customer === 'string' 
          ? stripeSubscription.customer 
          : null,
        stripeSubscriptionId: stripeSubscription.id,
        currentPeriodStart: stripeSubscription.current_period_start,
        currentPeriodEnd: stripeSubscription.current_period_end,
        status: normalizedStatus,
      }
    )

    return {
      matched: false,
      repaired: true,
      details: {
        stripeStatus: normalizedStatus,
        dbStatus: dbSubscription?.status,
        stripeTier: planCode,
        dbTier: dbSubscription?.tier,
      },
    }
  } catch (error: any) {
    console.error(`Failed to reconcile subscription for org ${organizationId}:`, error)
    return {
      matched: false,
      repaired: false,
      details: {},
    }
  }
}

/**
 * Reconcile all active subscriptions
 * 
 * Fetches all organizations with active subscriptions and reconciles each.
 * Use this in a cron job.
 */
export async function reconcileAllSubscriptions(): Promise<{
  total: number
  matched: number
  repaired: number
  errors: number
}> {
  const supabase = await createSupabaseServerClient()

  // Fetch all organizations with active subscriptions
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('organization_id, stripe_subscription_id, status')
    .not('stripe_subscription_id', 'is', null)
    .in('status', ['active', 'trialing', 'past_due'])

  if (error) {
    console.error('Failed to fetch subscriptions for reconciliation:', error)
    return { total: 0, matched: 0, repaired: 0, errors: 1 }
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { total: 0, matched: 0, repaired: 0, errors: 0 }
  }

  let matched = 0
  let repaired = 0
  let errors = 0

  // Reconcile each subscription
  for (const sub of subscriptions) {
    if (!sub.stripe_subscription_id) continue

    try {
      const result = await reconcileOrganizationSubscription(
        sub.organization_id,
        sub.stripe_subscription_id
      )

      if (result.matched) {
        matched++
      } else if (result.repaired) {
        repaired++
      } else {
        errors++
      }
    } catch (err) {
      console.error(`Error reconciling subscription ${sub.stripe_subscription_id}:`, err)
      errors++
    }
  }

  return {
    total: subscriptions.length,
    matched,
    repaired,
    errors,
  }
}

