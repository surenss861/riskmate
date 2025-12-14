/**
 * Enterprise Feature Usage Logging
 * 
 * Logs every premium feature event (allowed AND denied) for:
 * - Compliance audit trails
 * - Billing/analytics
 * - Security monitoring
 * 
 * Uses standardized event schema with idempotency keys.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Entitlements } from './entitlements'
import {
  type FeatureKey,
  type FeatureAction,
  type DenialCode,
  type EventSource,
  type ResourceType,
  type StandardFeatureEventMetadata,
  getEventName,
  getDenialCode,
  getRequestId,
  validateEventMetadata,
} from './featureEvents'

/**
 * Log a feature event to audit_logs table with standardized schema
 * 
 * This creates an immutable audit trail for compliance.
 * Logs both allowed and denied attempts.
 * Includes idempotency check to prevent duplicates.
 */
export async function logFeatureEvent(params: {
  feature: FeatureKey
  action: FeatureAction
  allowed: boolean
  organizationId: string
  actorId: string
  entitlements: Entitlements
  source: EventSource
  requestId?: string
  resourceType?: ResourceType
  resourceId?: string
  denialCode?: DenialCode
  reason?: string
  additionalMetadata?: Record<string, any>
}): Promise<void> {
  const {
    feature,
    action,
    allowed,
    organizationId,
    actorId,
    entitlements,
    source,
    requestId,
    resourceType,
    resourceId,
    denialCode,
    reason,
    additionalMetadata = {},
  } = params

  const supabase = await createSupabaseServerClient()
  const reqId = getRequestId(requestId)

  // Build standardized metadata
  const metadata: StandardFeatureEventMetadata = {
    feature_key: feature,
    action,
    allowed,
    plan_tier: entitlements.tier,
    subscription_status: entitlements.status,
    period_end: entitlements.period_end,
    org_id: organizationId,
    actor_id: actorId,
    request_id: reqId,
    source,
    resource_type: resourceType,
    resource_id: resourceId,
    timestamp: new Date().toISOString(),
    ...additionalMetadata,
  }

  // Add denial information if denied
  if (!allowed) {
    metadata.denial_code = denialCode || getDenialCode(
      entitlements.tier,
      entitlements.status,
      entitlements.period_end,
      reason
    )
    if (reason) {
      metadata.reason = reason
    }
  }

  // Validate metadata
  if (!validateEventMetadata(metadata)) {
    console.error('Invalid event metadata:', metadata)
    return
  }

  // Create standardized event name
  const eventName = getEventName(feature, action)

  // Check for duplicate (idempotency)
  // Use request_id + event_name as idempotency key
  const { data: existing } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('metadata->>request_id', reqId)
    .eq('event_name', eventName)
    .limit(1)
    .maybeSingle()

  if (existing) {
    // Already logged, skip (idempotent)
    return
  }

  // Build audit log entry
  const auditEntry = {
    organization_id: organizationId,
    actor_id: actorId,
    event_name: eventName,
    target_type: resourceType || 'feature',
    target_id: resourceId || null,
    metadata,
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
 * Includes idempotency check.
 */
export async function logUsage(params: {
  feature: FeatureKey
  organizationId: string
  requestId?: string
  count?: number
  metadata?: Record<string, any>
}): Promise<void> {
  const { feature, organizationId, requestId, count = 1, metadata = {} } = params

  const supabase = await createSupabaseServerClient()
  const reqId = getRequestId(requestId)

  // Map feature names to usage_logs item names
  const itemMap: Record<FeatureKey, string> = {
    permit_packs: 'permit_pack_generated',
    version_history: 'version_history_accessed',
    evidence_verification: 'evidence_verified',
    job_assignment: 'worker_assigned',
    job_creation: 'job_created',
    team_invite: 'team_member_invited',
  }

  const item = itemMap[feature] || feature

  // Check for duplicate (idempotency)
  // Use request_id + item as idempotency key
  const { data: existing } = await supabase
    .from('usage_logs')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('item', item)
    .eq('metadata->>request_id', reqId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    // Already logged, skip (idempotent)
    return
  }

  const { error } = await supabase
    .from('usage_logs')
    .insert({
      organization_id: organizationId,
      item,
      count,
      metadata: {
        ...metadata,
        request_id: reqId,
      },
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
 * 
 * IMPORTANT: Pass entitlements object (not re-fetch) to ensure consistency.
 */
export async function logFeatureUsage(params: {
  feature: FeatureKey
  action: FeatureAction
  allowed: boolean
  organizationId: string
  actorId: string
  entitlements: Entitlements // Request-scoped snapshot (no re-fetch)
  source: EventSource
  requestId?: string
  resourceType?: ResourceType
  resourceId?: string
  denialCode?: DenialCode
  reason?: string
  additionalMetadata?: Record<string, any>
  logUsage?: boolean // Only log usage if allowed (default: true)
}): Promise<void> {
  const {
    feature,
    action,
    allowed,
    organizationId,
    actorId,
    entitlements,
    source,
    requestId,
    resourceType,
    resourceId,
    denialCode,
    reason,
    additionalMetadata,
    logUsage: shouldLogUsage = true,
  } = params

  const reqId = getRequestId(requestId)

  // Always log to audit_logs (both allowed and denied)
  await logFeatureEvent({
    feature,
    action,
    allowed,
    organizationId,
    actorId,
    entitlements,
    source,
    requestId: reqId,
    resourceType,
    resourceId,
    denialCode,
    reason,
    additionalMetadata,
  })

  // Only log usage if allowed and requested
  if (allowed && shouldLogUsage) {
    await logUsage({
      feature,
      organizationId,
      requestId: reqId,
      metadata: {
        plan_tier: entitlements.tier,
        subscription_status: entitlements.status,
        period_end: entitlements.period_end,
        ...additionalMetadata,
      },
    })
  }
}
