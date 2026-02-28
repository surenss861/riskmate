/**
 * Webhook delivery: enqueue deliveries for events, send with HMAC signature, retry with backoff.
 * Retry: 5min → 30min → 2hr → 24hr → fail. Alert org admin after 5 consecutive failures.
 * Secrets are read from webhook_endpoint_secrets (service-role only). Rotate SUPABASE_SERVICE_ROLE_KEY
 * regularly and restrict/audit service-role access.
 */
export type WebhookEventType = 'job.created' | 'job.updated' | 'job.completed' | 'job.deleted' | 'hazard.created' | 'hazard.updated' | 'signature.added' | 'report.generated' | 'evidence.uploaded' | 'team.member_added';
/** Strict allowlist for internal emit endpoint; do not accept arbitrary event_type from callers. */
export declare const ALLOWED_WEBHOOK_EVENT_TYPES: readonly WebhookEventType[];
/**
 * Validate payload shape for internal emit. Ensures data is a non-null object and has required fields per event type.
 */
export declare function validateWebhookEmitPayload(eventType: string, data: unknown): {
    valid: true;
} | {
    valid: false;
    message: string;
};
export interface WebhookEventPayload {
    id: string;
    type: string;
    created: string;
    organization_id: string;
    data: Record<string, unknown>;
}
interface WebhookDeliveryRow {
    id: string;
    endpoint_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    response_status: number | null;
    response_body: string | null;
    duration_ms: number | null;
    attempt_count: number;
    delivered_at: string | null;
    next_retry_at: string | null;
    processing_since: string | null;
    created_at: string;
}
/**
 * Build the standard event payload envelope.
 */
export declare function buildWebhookPayload(eventType: string, organizationId: string, data: Record<string, unknown>): WebhookEventPayload;
/**
 * Find active endpoints for org that subscribe to this event type; create one delivery row per endpoint.
 * Used by Express backend only. Next.js uses triggerWebhookEvent (lib/webhooks/trigger.ts). Do not call both for the same logical operation — each request path must emit from one stack only to avoid duplicate deliveries.
 */
export declare function deliverEvent(orgId: string, eventType: string, data: Record<string, unknown>): Promise<void>;
/**
 * Send one delivery: POST to endpoint URL with signed payload, update row, record attempt.
 * If the endpoint is inactive (paused), does not send; terminalizes the delivery with a clear message.
 */
export declare function sendDelivery(delivery: WebhookDeliveryRow): Promise<void>;
/**
 * Schedule an immediate, debounced run of the delivery worker so fresh enqueues are processed
 * without waiting for the next interval tick. Safe to call from both deliverEvent() and from
 * the internal wake endpoint (Next.js trigger path). Reuses processPendingDeliveriesRunning guard.
 */
export declare function wakeWebhookWorker(): void;
export declare function startWebhookDeliveryWorker(): void;
export declare function stopWebhookDeliveryWorker(): void;
export {};
//# sourceMappingURL=webhookDelivery.d.ts.map