/**
 * Canonical webhook payload schemas per event type.
 * Must stay in sync with app lib/webhooks/payloads.ts so consumers
 * receive a stable data.object contract regardless of producer (web vs backend).
 */
/**
 * Return normalized data.object for the given event type.
 * For event types without a canonical schema, returns raw data unchanged.
 */
export declare function buildWebhookEventObject(eventType: string, raw: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=webhookPayloads.d.ts.map