/**
 * Subscription Sync Utility
 * 
 * Shared utility for syncing subscription state to database.
 * Used by webhook handlers and reconciliation jobs.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type PlanCode = 'starter' | 'pro' | 'business'

interface PlanLimits {
  seats: number | null
  jobsMonthly: number | null
}

function limitsFor(plan: PlanCode): PlanLimits {
  switch (plan) {
    case 'starter':
      return { seats: 1, jobsMonthly: 10 }
    case 'pro':
      return { seats: 5, jobsMonthly: null } // unlimited
    case 'business':
      return { seats: null, jobsMonthly: null } // unlimited
    default:
      return { seats: 1, jobsMonthly: 10 }
  }
}

export interface ApplyPlanOptions {
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  currentPeriodStart?: number | null
  currentPeriodEnd?: number | null
  status?: string | null
  seatsLimitOverride?: number | null
  jobsLimitOverride?: number | null
}

/**
 * Apply plan to organization
 * 
 * Updates org_subscriptions, organizations, and subscriptions tables.
 * This is the single source of truth for subscription state.
 */
export async function applyPlanToOrganization(
  organizationId: string,
  plan: PlanCode,
  options: ApplyPlanOptions
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const limits = limitsFor(plan)
  
  // Normalize status
  const rawStatus = options.status?.toLowerCase() ?? 'active'
  let status: string
  switch (rawStatus) {
    case 'trialing':
      status = 'trialing'
      break
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      status = 'past_due'
      break
    case 'canceled':
    case 'cancelled':
      status = 'canceled'
      break
    default:
      status = 'active'
  }

  const baseSeats = options.seatsLimitOverride ?? limits.seats ?? null
  const baseJobs = options.jobsLimitOverride ?? limits.jobsMonthly ?? null
  const isActive = status === 'active' || status === 'trialing'

  const seatsLimit = isActive ? baseSeats : 0
  const jobsLimit = isActive ? baseJobs : 0

  const timestamp = new Date().toISOString()

  // Update org_subscriptions (primary source)
  const { error: orgSubError } = await supabase
    .from('org_subscriptions')
    .upsert(
      {
        organization_id: organizationId,
        plan_code: plan,
        seats_limit: seatsLimit,
        jobs_limit_month: jobsLimit,
        status,
        stripe_customer_id: options.stripeCustomerId ?? null,
        stripe_subscription_id: options.stripeSubscriptionId ?? null,
        current_period_start: options.currentPeriodStart
          ? new Date(options.currentPeriodStart * 1000).toISOString()
          : null,
        current_period_end: options.currentPeriodEnd
          ? new Date(options.currentPeriodEnd * 1000).toISOString()
          : null,
        updated_at: timestamp,
      },
      { onConflict: 'organization_id' }
    )

  if (orgSubError) {
    console.error('Failed to upsert org_subscriptions:', orgSubError)
    throw orgSubError
  }

  // Update organizations table
  const { error: orgUpdateError } = await supabase
    .from('organizations')
    .update({
      subscription_tier: plan,
      subscription_status: status,
      updated_at: timestamp,
    })
    .eq('id', organizationId)

  if (orgUpdateError) {
    console.error('Failed to update organizations subscription tier:', orgUpdateError)
    throw orgUpdateError
  }

  // Update subscriptions table (for backward compatibility)
  const subscriptionPayload: Record<string, any> = {
    organization_id: organizationId,
    tier: plan,
    status,
    stripe_customer_id: options.stripeCustomerId ?? null,
    stripe_subscription_id: options.stripeSubscriptionId ?? null,
    current_period_start: options.currentPeriodStart
      ? new Date(options.currentPeriodStart * 1000).toISOString()
      : null,
    current_period_end: options.currentPeriodEnd
      ? new Date(options.currentPeriodEnd * 1000).toISOString()
      : null,
    updated_at: timestamp,
  }

  // Check if subscription exists
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingSub) {
    // Update existing
    const { error: subUpdateError } = await supabase
      .from('subscriptions')
      .update(subscriptionPayload)
      .eq('id', existingSub.id)

    if (subUpdateError) {
      console.error('Failed to update subscriptions:', subUpdateError)
      throw subUpdateError
    }
  } else {
    // Insert new
    const { error: subInsertError } = await supabase
      .from('subscriptions')
      .insert(subscriptionPayload)

    if (subInsertError) {
      console.error('Failed to insert subscriptions:', subInsertError)
      throw subInsertError
    }
  }
}

