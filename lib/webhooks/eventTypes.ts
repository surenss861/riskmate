/**
 * Webhook event type constants and types. Shared by client (modals, UI) and server (API, trigger).
 * No server-only imports — safe for client bundles.
 */

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
