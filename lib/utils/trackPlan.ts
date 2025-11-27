/**
 * Plan Tracking Utilities
 * 
 * Tracks organization plan information in the backend for analytics and monitoring.
 * Plans are organization-level (all users in an org share the same plan),
 * but we track which user (actor) initiated plan-related actions.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface PlanTrackingEvent {
  organization_id: string
  user_id: string
  event_name: string
  current_plan: string | null
  previous_plan?: string | null
  metadata?: Record<string, any>
}

/**
 * Track a plan-related event in audit_logs and plan_tracking
 */
export async function trackPlanEvent(event: PlanTrackingEvent): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Track in audit_logs (for compliance/audit trail)
    await supabase.from('audit_logs').insert({
      organization_id: event.organization_id,
      actor_id: event.user_id,
      event_name: event.event_name,
      target_type: 'subscription',
      metadata: {
        current_plan: event.current_plan,
        previous_plan: event.previous_plan,
        ...event.metadata,
      },
    })

    // Also track in plan_tracking table (for analytics)
    if (event.current_plan) {
      const eventTypeMap: Record<string, string> = {
        'subscription.plan_viewed': 'view',
        'subscription.plan_switch_initiated': 'switch_initiated',
        'subscription.plan_changed': 'switch_success',
        'subscription.plan_switch_failed': 'switch_failed',
        'subscription.checkout_redirected': 'checkout_redirected',
      }

      const eventType = eventTypeMap[event.event_name] || 'unknown'

      await supabase.from('plan_tracking').insert({
        organization_id: event.organization_id,
        user_id: event.user_id,
        plan_code: event.current_plan,
        previous_plan_code: event.previous_plan || null,
        event_type: eventType,
        is_upgrade: event.metadata?.is_upgrade ?? null,
        is_downgrade: event.metadata?.is_downgrade ?? null,
        metadata: event.metadata || {},
      })
    }
  } catch (error) {
    // Don't throw - tracking failures shouldn't break the main flow
    console.error('Failed to track plan event:', error)
  }
}

/**
 * Track plan change event
 */
export async function trackPlanChange(
  organizationId: string,
  userId: string,
  fromPlan: string | null,
  toPlan: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  await trackPlanEvent({
    organization_id: organizationId,
    user_id: userId,
    event_name: 'subscription.plan_changed',
    current_plan: toPlan,
    previous_plan: fromPlan,
    metadata: {
      is_upgrade: toPlan === 'pro' || toPlan === 'business',
      is_downgrade: toPlan === 'starter' && fromPlan !== 'starter',
      ...metadata,
    },
  })
}

/**
 * Track plan view event (when user views plan change page)
 */
export async function trackPlanView(
  organizationId: string,
  userId: string,
  currentPlan: string | null
): Promise<void> {
  await trackPlanEvent({
    organization_id: organizationId,
    user_id: userId,
    event_name: 'subscription.plan_viewed',
    current_plan: currentPlan,
  })
}

/**
 * Track plan switch initiation
 */
export async function trackPlanSwitchInitiated(
  organizationId: string,
  userId: string,
  fromPlan: string | null,
  toPlan: string | null
): Promise<void> {
  await trackPlanEvent({
    organization_id: organizationId,
    user_id: userId,
    event_name: 'subscription.plan_switch_initiated',
    current_plan: fromPlan,
    metadata: {
      target_plan: toPlan,
      is_upgrade: toPlan === 'pro' || toPlan === 'business',
      is_downgrade: toPlan === 'starter' && fromPlan !== 'starter',
    },
  })
}

/**
 * Track successful plan switch
 */
export async function trackPlanSwitchSuccess(
  organizationId: string,
  userId: string,
  fromPlan: string | null,
  toPlan: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  await trackPlanChange(organizationId, userId, fromPlan, toPlan, {
    ...metadata,
    success: true,
  })
}

/**
 * Track failed plan switch
 */
export async function trackPlanSwitchFailed(
  organizationId: string,
  userId: string,
  fromPlan: string | null,
  toPlan: string | null,
  error: string
): Promise<void> {
  await trackPlanEvent({
    organization_id: organizationId,
    user_id: userId,
    event_name: 'subscription.plan_switch_failed',
    current_plan: fromPlan,
    metadata: {
      target_plan: toPlan,
      error: error,
    },
  })
}


 * 
 * Tracks user plan information in the backend for analytics and monitoring
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface PlanTrackingEvent {
  organization_id: string
  user_id: string
  event_name: string
  current_plan: string | null
  previous_plan?: string | null
  metadata?: Record<string, any>
}

/**
 * Track a plan-related event in audit_logs and plan_tracking
 */
export async function trackPlanEvent(event: PlanTrackingEvent): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Track in audit_logs (for compliance/audit trail)
    await supabase.from('audit_logs').insert({
      organization_id: event.organization_id,
      actor_id: event.user_id,
      event_name: event.event_name,
      target_type: 'subscription',
      metadata: {
        current_plan: event.current_plan,
        previous_plan: event.previous_plan,
        ...event.metadata,
      },
    })

    // Also track in plan_tracking table (for analytics)
    if (event.current_plan) {
      const eventTypeMap: Record<string, string> = {
        'subscription.plan_viewed': 'view',
        'subscription.plan_switch_initiated': 'switch_initiated',
        'subscription.plan_changed': 'switch_success',
        'subscription.plan_switch_failed': 'switch_failed',
        'subscription.checkout_redirected': 'checkout_redirected',
      }

      const eventType = eventTypeMap[event.event_name] || 'unknown'

      await supabase.from('plan_tracking').insert({
        organization_id: event.organization_id,
        user_id: event.user_id,
        plan_code: event.current_plan,
        previous_plan_code: event.previous_plan || null,
        event_type: eventType,
        is_upgrade: event.metadata?.is_upgrade ?? null,
        is_downgrade: event.metadata?.is_downgrade ?? null,
        metadata: event.metadata || {},
      })
    }
  } catch (error) {
    // Don't throw - tracking failures shouldn't break the main flow
    console.error('Failed to track plan event:', error)
  }
}

/**
 * Track plan change event
 */
export async function trackPlanChange(
  organizationId: string,
  userId: string,
  fromPlan: string | null,
  toPlan: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  await trackPlanEvent({
    organization_id: organizationId,
    user_id: userId,
    event_name: 'subscription.plan_changed',
    current_plan: toPlan,
    previous_plan: fromPlan,
    metadata: {
      is_upgrade: toPlan === 'pro' || toPlan === 'business',
      is_downgrade: toPlan === 'starter' && fromPlan !== 'starter',
      ...metadata,
    },
  })
}

/**
 * Track plan view event (when user views plan change page)
 */
export async function trackPlanView(
  organizationId: string,
  userId: string,
  currentPlan: string | null
): Promise<void> {
  await trackPlanEvent({
    organization_id: organizationId,
    user_id: userId,
    event_name: 'subscription.plan_viewed',
    current_plan: currentPlan,
  })
}

/**
 * Track plan switch initiation
 */
export async function trackPlanSwitchInitiated(
  organizationId: string,
  userId: string,
  fromPlan: string | null,
  toPlan: string | null
): Promise<void> {
  await trackPlanEvent({
    organization_id: organizationId,
    user_id: userId,
    event_name: 'subscription.plan_switch_initiated',
    current_plan: fromPlan,
    metadata: {
      target_plan: toPlan,
      is_upgrade: toPlan === 'pro' || toPlan === 'business',
      is_downgrade: toPlan === 'starter' && fromPlan !== 'starter',
    },
  })
}

/**
 * Track successful plan switch
 */
export async function trackPlanSwitchSuccess(
  organizationId: string,
  userId: string,
  fromPlan: string | null,
  toPlan: string | null,
  metadata?: Record<string, any>
): Promise<void> {
  await trackPlanChange(organizationId, userId, fromPlan, toPlan, {
    ...metadata,
    success: true,
  })
}

/**
 * Track failed plan switch
 */
export async function trackPlanSwitchFailed(
  organizationId: string,
  userId: string,
  fromPlan: string | null,
  toPlan: string | null,
  error: string
): Promise<void> {
  await trackPlanEvent({
    organization_id: organizationId,
    user_id: userId,
    event_name: 'subscription.plan_switch_failed',
    current_plan: fromPlan,
    metadata: {
      target_plan: toPlan,
      error: error,
    },
  })
}

