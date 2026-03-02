/**
 * Canonical webhook payload normalization for backend (self-contained).
 * Mirrors lib/webhooks/payloads.ts so the backend does not depend on repo-root lib at runtime
 * (Node cannot resolve @/ in compiled output). Keep in sync with lib/webhooks/payloads.ts for
 * report.generated, evidence.uploaded, and signature.added.
 */
/**
 * Return normalized data.object for the given event type.
 * For event types without a canonical schema, returns raw data unchanged.
 */
export declare function buildWebhookEventObject(eventType: string, raw: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=webhookPayloads.d.ts.map