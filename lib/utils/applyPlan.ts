import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PlanCode, limitsFor } from './planRules'

export async function applyPlanToOrganization(
  organizationId: string,
  plan: PlanCode,
  options: {
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    currentPeriodStart?: number | null
    currentPeriodEnd?: number | null
    status?: string | null
  }
) {
  const supabase = await createSupabaseServerClient()
  const limits = limitsFor(plan)
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

  const isActive = status === 'active' || status === 'trialing'
  const seatsLimit = isActive ? limits.seats : 0
  const jobsLimit = isActive ? limits.jobsMonthly : 0
  const timestamp = new Date().toISOString()

  // Update org_subscriptions
  await supabase.from('org_subscriptions').upsert(
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

  // Update organizations table
  await supabase
    .from('organizations')
    .update({
      subscription_tier: plan,
      subscription_status: status,
      updated_at: timestamp,
    })
    .eq('id', organizationId)

  // Update subscriptions table
  await supabase.from('subscriptions').upsert(
    {
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
    },
    { onConflict: 'organization_id' }
  )
}

