/**
 * Enterprise Feature Usage Logging
 * 
 * Logs every premium feature event (allowed AND denied) for:
 * - Compliance audit trails
 * - Billing/analytics
 * - Security monitoring
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PlanTier, SubscriptionStatus } from './entitlements'

export type FeatureName = 
  | 'permit_pack'
  | 'version_history'
  | 'evidence_verification'
  | 'job_assignment'
  | 'job_creation'
  | 'team_invite'

export type FeatureAction = 
  | 'generated'
  | 'accessed'
  | 'created'
  | 'assigned'
  | 'verified'
  | 'denied'
  | 'attempted'

export interface FeatureEventMetadata {
  plan_tier: PlanTier
  subscription_status: SubscriptionStatus
  period_end: string | null
  reason?: string // For denied events
  request_id?: string
  job_id?: string
  worker_id?: string
  document_id?: string
  [key: string]: any // Allow additional metadata
}

/**
 * Log a feature event to audit_logs table
 * 
 * This creates an immutable audit trail for compliance.
 * Logs both allowed and denied attempts.
 */
export async function logFeatureEvent(params: {
  feature: FeatureName
  action: FeatureAction
  allowed: boolean
  organizationId: string
  actorId: string
  metadata: FeatureEventMetadata
  targetType?: string
  targetId?: string
}): Promise<void> {
  const {
    feature,
    action,
    allowed,
    organizationId,
    actorId,
    metadata,
    targetType,
    targetId,
  } = params

  const supabase = await createSupabaseServerClient()

  // Create event name
  const eventName = `${feature}.${action}`

  // Build audit log entry
  const auditEntry = {
    organization_id: organizationId,
    actor_id: actorId,
    event_name: eventName,
    target_type: targetType || 'feature',
    target_id: targetId || null,
    metadata: {
      ...metadata,
      allowed,
      feature,
      action,
      timestamp: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from('audit_logs')
    .insert(auditEntry)

  if (error) {
    console.error('Failed to log feature event to audit_logs:', error)
    // Don't throw - logging failures shouldn't break the feature
  }
}

/**
 * Log usage to usage_logs table
 * 
 * This is for metering/analytics/billing.
 * Only logs successful usage (not denied attempts).
 */
export async function logUsage(params: {
  feature: FeatureName
  organizationId: string
  count?: number
  metadata?: Record<string, any>
}): Promise<void> {
  const { feature, organizationId, count = 1, metadata = {} } = params

  const supabase = await createSupabaseServerClient()

  // Map feature names to usage_logs item names
  const itemMap: Record<FeatureName, string> = {
    permit_pack: 'permit_pack_generated',
    version_history: 'version_history_accessed',
    evidence_verification: 'evidence_verified',
    job_assignment: 'worker_assigned',
    job_creation: 'job_created',
    team_invite: 'team_member_invited',
  }

  const item = itemMap[feature] || feature

  const { error } = await supabase
    .from('usage_logs')
    .insert({
      organization_id: organizationId,
      item,
      count,
      metadata,
    })

  if (error) {
    console.error('Failed to log usage:', error)
    // Don't throw - logging failures shouldn't break the feature
  }
}

/**
 * Log a feature event (both audit and usage)
 * 
 * Convenience function that logs to both tables.
 * Use this for most feature events.
 */
export async function logFeatureUsage(params: {
  feature: FeatureName
  action: FeatureAction
  allowed: boolean
  organizationId: string
  actorId: string
  metadata: FeatureEventMetadata
  targetType?: string
  targetId?: string
  logUsage?: boolean // Only log usage if allowed (default: true)
}): Promise<void> {
  const {
    feature,
    action,
    allowed,
    organizationId,
    actorId,
    metadata,
    targetType,
    targetId,
    logUsage: shouldLogUsage = true,
  } = params

  // Always log to audit_logs (both allowed and denied)
  await logFeatureEvent({
    feature,
    action,
    allowed,
    organizationId,
    actorId,
    metadata,
    targetType,
    targetId,
  })

  // Only log usage if allowed and requested
  if (allowed && shouldLogUsage) {
    await logUsage({
      feature,
      organizationId,
      metadata: {
        plan_tier: metadata.plan_tier,
        subscription_status: metadata.subscription_status,
      },
    })
  }
}

