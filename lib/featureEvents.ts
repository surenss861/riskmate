/**
 * Standardized Feature Event Schema
 * 
 * Single source of truth for event naming and metadata.
 * Enforces consistency across all feature logging.
 */

export type FeatureKey = 
  | 'permit_packs'
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
  | 'limit_denied'

export type DenialCode =
  | 'PLAN_TIER_INSUFFICIENT'
  | 'SUBSCRIPTION_PAST_DUE'
  | 'SUBSCRIPTION_CANCELED_PERIOD_ENDED'
  | 'MONTHLY_LIMIT_REACHED'
  | 'SEAT_LIMIT_REACHED'
  | 'ROLE_FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'UNKNOWN_ERROR'

export type EventSource = 'api' | 'ui' | 'cron' | 'webhook'

export type ResourceType = 'job' | 'organization' | 'user' | 'document' | 'feature'

/**
 * Standardized event name format: feature.<feature_key>.<action>
 */
export function getEventName(feature: FeatureKey, action: FeatureAction): string {
  return `feature.${feature}.${action}`
}

/**
 * Required metadata fields for every feature event
 */
export interface StandardFeatureEventMetadata {
  // Core fields (required)
  feature_key: FeatureKey
  action: FeatureAction
  allowed: boolean
  plan_tier: string
  subscription_status: string
  period_end: string | null
  org_id: string
  actor_id: string
  request_id: string
  source: EventSource
  resource_type?: ResourceType
  resource_id?: string
  
  // Denial information (if denied)
  denial_code?: DenialCode
  reason?: string
  
  // Timestamp
  timestamp: string
  
  // Feature-specific metadata (optional)
  [key: string]: any
}

/**
 * Validate that metadata contains all required fields
 */
export function validateEventMetadata(
  metadata: Partial<StandardFeatureEventMetadata>
): metadata is StandardFeatureEventMetadata {
  const required = [
    'feature_key',
    'action',
    'allowed',
    'plan_tier',
    'subscription_status',
    'org_id',
    'actor_id',
    'request_id',
    'source',
    'timestamp',
  ]
  
  return required.every(field => field in metadata)
}

/**
 * Get denial code from entitlement error
 */
export function getDenialCode(
  tier: string,
  status: string,
  periodEnd: string | null,
  reason?: string
): DenialCode {
  if (status === 'past_due') {
    return 'SUBSCRIPTION_PAST_DUE'
  }
  
  if (status === 'canceled') {
    const isExpired = periodEnd ? new Date(periodEnd) < new Date() : false
    if (isExpired) {
      return 'SUBSCRIPTION_CANCELED_PERIOD_ENDED'
    }
  }
  
  if (reason?.includes('limit reached') || reason?.includes('limit exceeded')) {
    if (reason.includes('job') || reason.includes('monthly')) {
      return 'MONTHLY_LIMIT_REACHED'
    }
    if (reason.includes('seat')) {
      return 'SEAT_LIMIT_REACHED'
    }
  }
  
  if (reason?.includes('role') || reason?.includes('permission')) {
    return 'ROLE_FORBIDDEN'
  }
  
  if (tier !== 'business' && (reason?.includes('Business plan') || reason?.includes('Business'))) {
    return 'PLAN_TIER_INSUFFICIENT'
  }
  
  return 'UNKNOWN_ERROR'
}

/**
 * Generate request ID (or use provided)
 */
export function getRequestId(requestId?: string): string {
  if (requestId) return requestId
  
  // Generate UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

