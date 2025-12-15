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
 * 
 * Checks both org_subscriptions and subscriptions tables.
 * Prioritizes org_subscriptions.plan_code, then subscriptions.tier.
 * This matches the subscriptions API behavior.
 */
export async function getOrgSubscription(
  organizationId: string
): Promise<OrgSubscription | null> {
  const supabase = await createSupabaseServerClient()
  
  // Get plan from org_subscriptions (primary source)
  const { data: orgSubscription, error: orgSubError } = await supabase
    .from('org_subscriptions')
    .select('plan_code, status, current_period_start, current_period_end, stripe_subscription_id, stripe_customer_id')
    .eq('organization_id', organizationId)
    .maybeSingle()

  // Get subscription for billing period and Stripe info
  const { data: subscription, error: subError } = await supabase
    .from('subscriptions')
    .select('tier, status, current_period_start, current_period_end, organization_id, stripe_subscription_id, stripe_customer_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Handle errors (PGRST116 = no rows found, which is OK)
  if (orgSubError && orgSubError.code !== 'PGRST116') {
    console.error('Failed to fetch org_subscriptions:', orgSubError)
  }
  if (subError && subError.code !== 'PGRST116') {
    console.error('Failed to fetch subscriptions:', subError)
  }

  // Prioritize org_subscriptions.plan_code, then subscriptions.tier
  const tier = (orgSubscription?.plan_code as PlanTier) || 
               (subscription?.tier as PlanTier) || 
               'starter'

  // Use status from subscriptions if available, otherwise org_subscriptions
  // If tier is business/pro but status is missing, default to 'active' (assume active subscription)
  let status: SubscriptionStatus = (subscription?.status as SubscriptionStatus) || 
                                   (orgSubscription?.status as SubscriptionStatus) || 
                                   null
  
  // If we have a tier but no status, assume active (common for new subscriptions)
  if (!status && tier !== 'starter') {
    status = 'active'
  }
  
  // Final fallback
  if (!status) {
    status = 'none'
  }

  // Use period dates from either source (prefer subscription if both exist)
  const current_period_start = subscription?.current_period_start || orgSubscription?.current_period_start || null
  const current_period_end = subscription?.current_period_end || orgSubscription?.current_period_end || null

  // Use Stripe IDs from either source (prefer subscription if both exist)
  const stripe_subscription_id = subscription?.stripe_subscription_id || orgSubscription?.stripe_subscription_id || null
  const stripe_customer_id = subscription?.stripe_customer_id || orgSubscription?.stripe_customer_id || null

  // If we have at least a tier, return subscription object
  if (tier !== 'starter' || orgSubscription || subscription) {
    return {
      tier,
      status,
      current_period_start,
      current_period_end,
      organization_id: organizationId,
      stripe_subscription_id,
      stripe_customer_id,
    }
  }

  return null
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

  // Normalize status (handle null/undefined)
  // If status is 'none' but tier is business/pro, assume active (common for new subscriptions)
  const effectiveStatus = status === 'none' && tier !== 'starter' ? 'active' : status
  
  // Check if subscription is active
  // Allow 'active', 'trialing', or 'none' with non-starter tier (assume active)
  const isActive = effectiveStatus === 'active' || effectiveStatus === 'trialing'
  
  // Check if canceled subscription is still in period
  const isCanceledButInPeriod = effectiveStatus === 'canceled' && current_period_end
    ? new Date(current_period_end) > new Date()
    : false

  // Effective access: active, trialing, or canceled but still in period
  const hasAccess = isActive || isCanceledButInPeriod

  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && tier === 'business' && !hasAccess) {
    console.warn('Business plan access denied:', {
      tier,
      status: effectiveStatus,
      originalStatus: status,
      current_period_end,
      isActive,
      isCanceledButInPeriod,
      hasAccess,
    })
  }

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

