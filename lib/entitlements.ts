/**
 * Enterprise-Grade Entitlement System
 * 
 * Single source of truth for feature access control.
 * All premium features must go through this layer.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export type PlanTier = 'starter' | 'pro' | 'business'
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none'

export interface OrgSubscription {
  tier: PlanTier
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  organization_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
}

export interface Entitlements {
  // Premium features
  permit_packs: boolean
  version_history: boolean
  evidence_verification: boolean
  job_assignment: boolean
  
  // Limits
  jobs_monthly_limit: number | null // null = unlimited
  seats_limit: number | null // null = unlimited
  
  // Metadata
  tier: PlanTier
  status: SubscriptionStatus
  period_end: string | null
}

export class EntitlementError extends Error {
  constructor(
    public feature: string,
    public tier: PlanTier,
    public status: SubscriptionStatus,
    message?: string
  ) {
    super(message || `Feature '${feature}' requires Business plan (current: ${tier}, status: ${status})`)
    this.name = 'EntitlementError'
  }
}

/**
 * Get organization subscription from database (source of truth)
 */
export async function getOrgSubscription(
  organizationId: string
): Promise<OrgSubscription | null> {
  const supabase = await createSupabaseServerClient()
  
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_start, current_period_end, organization_id, stripe_subscription_id, stripe_customer_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (expected for new orgs)
    console.error('Failed to fetch subscription:', error)
    return null
  }

  if (!subscription) {
    return null
  }

  return {
    tier: (subscription.tier as PlanTier) || 'starter',
    status: (subscription.status as SubscriptionStatus) || 'none',
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    organization_id: subscription.organization_id,
    stripe_subscription_id: subscription.stripe_subscription_id,
    stripe_customer_id: subscription.stripe_customer_id,
  }
}

/**
 * Derive entitlements from subscription
 * 
 * Rules:
 * - active || trialing = full access
 * - past_due = hard block (no grace period for compliance)
 * - canceled = restrict at period_end (check current_period_end)
 * - none = starter defaults
 */
export function getEntitlements(
  subscription: OrgSubscription | null
): Entitlements {
  // Default to starter if no subscription
  if (!subscription) {
    return {
      permit_packs: false,
      version_history: false,
      evidence_verification: true, // Available on all plans
      job_assignment: true, // Available on all plans
      jobs_monthly_limit: 10,
      seats_limit: 1,
      tier: 'starter',
      status: 'none',
      period_end: null,
    }
  }

  const { tier, status, current_period_end } = subscription

  // Check if subscription is active
  const isActive = status === 'active' || status === 'trialing'
  
  // Check if canceled subscription is still in period
  const isCanceledButInPeriod = status === 'canceled' && current_period_end
    ? new Date(current_period_end) > new Date()
    : false

  // Effective access: active, trialing, or canceled but still in period
  const hasAccess = isActive || isCanceledButInPeriod

  // Feature entitlements
  const permit_packs = hasAccess && tier === 'business'
  const version_history = hasAccess && tier === 'business'
  const evidence_verification = true // All plans
  const job_assignment = true // All plans

  // Limits
  let jobs_monthly_limit: number | null = null
  let seats_limit: number | null = null

  if (hasAccess) {
    switch (tier) {
      case 'starter':
        jobs_monthly_limit = 10
        seats_limit = 1
        break
      case 'pro':
        jobs_monthly_limit = null // unlimited
        seats_limit = 5
        break
      case 'business':
        jobs_monthly_limit = null // unlimited
        seats_limit = null // unlimited
        break
    }
  } else {
    // No access = no limits (everything blocked)
    jobs_monthly_limit = 0
    seats_limit = 0
  }

  return {
    permit_packs,
    version_history,
    evidence_verification,
    job_assignment,
    jobs_monthly_limit,
    seats_limit,
    tier,
    status,
    period_end: current_period_end,
  }
}

/**
 * Assert that an entitlement exists, throw if not
 * 
 * Use this in route handlers to enforce access control
 */
export function assertEntitled(
  entitlements: Entitlements,
  feature: keyof Pick<Entitlements, 'permit_packs' | 'version_history' | 'evidence_verification' | 'job_assignment'>
): void {
  if (!entitlements[feature]) {
    throw new EntitlementError(
      feature,
      entitlements.tier,
      entitlements.status,
      `Feature '${feature}' is not available on ${entitlements.tier} plan (status: ${entitlements.status})`
    )
  }
}

/**
 * Check if organization has access to a feature
 * 
 * Returns true/false without throwing (useful for UI checks)
 */
export function hasEntitlement(
  entitlements: Entitlements,
  feature: keyof Pick<Entitlements, 'permit_packs' | 'version_history' | 'evidence_verification' | 'job_assignment'>
): boolean {
  return entitlements[feature] === true
}

/**
 * Get entitlements for an organization (convenience function)
 * 
 * Combines getOrgSubscription + getEntitlements
 */
export async function getOrgEntitlements(
  organizationId: string
): Promise<Entitlements> {
  const subscription = await getOrgSubscription(organizationId)
  return getEntitlements(subscription)
}

