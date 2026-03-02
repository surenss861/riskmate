/**
 * Re-export canonical webhook payload normalization from shared lib.
 * Single source of truth: lib/webhooks/payloads.ts (CI checks that this file re-exports from lib).
 */

export { buildWebhookEventObject } from '@/lib/webhooks/payloads'
