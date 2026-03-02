/**
 * Webhook event type constants and types. Shared by client (modals, UI) and server (API, trigger).
 * No server-only imports — safe for client bundles.
 */

/** Max delivery attempts per row; shared with worker and API for can_retry / claim logic. */
export const WEBHOOK_MAX_ATTEMPTS = 5

export const WEBHOOK_EVENT_TYPES = [
  'job.created',
  'job.updated',
  'job.completed',
  'job.deleted',
  'hazard.created',
  'hazard.updated',
  'signature.added',
  'report.generated',
  'evidence.uploaded',
  'team.member_added',
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]
