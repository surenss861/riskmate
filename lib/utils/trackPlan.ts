/**
 * Plan Tracking Utilities
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
 * Track a plan-related event in audit_logs
 */
export async function trackPlanEvent(event: PlanTrackingEvent): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()
    
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

