/**
 * Webhook delivery: enqueue deliveries for events, send with HMAC signature, retry with backoff.
 * Retry: 5min → 30min → 2hr → 24hr → fail. Alert org admin when a single delivery exhausts its retry attempts (with cooldown).
 * Secrets are read from webhook_endpoint_secrets (service-role only). Rotate SUPABASE_SERVICE_ROLE_KEY
 * regularly and restrict/audit service-role access.
 */
export declare const MAX_ATTEMPTS = 5;
/**
 * Parse an env value as a finite integer within [min, max]; invalid or out-of-range yields default.
 * Prevents NaN from non-numeric env (e.g. WEBHOOK_DELIVERY_CONCURRENCY=foo) from creating zero workers
 * or WEBHOOK_WORKER_INTERVAL_MS from becoming 0ms and causing tight-loop polling.
 */
export declare function parseSafeBoundedInt(envValue: string | undefined, defaultVal: number, min: number, max: number): number;
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
 * Endpoint and secret are fetched in one atomic query to avoid TOCTOU.
 */
export declare function sendDelivery(delivery: WebhookDeliveryRow): Promise<void>;
/**
 * Schedule an immediate, debounced run of the delivery worker so fresh enqueues are processed
 * without waiting for the next interval tick. Safe to call from both deliverEvent() and from
 * the internal wake endpoint (Next.js trigger path). Reuses processPendingDeliveriesRunning guard.
 */
export declare function wakeWebhookWorker(): void;
/** Result of starting the webhook delivery worker; allows bootstrap to handle startup failure without exiting the process. */
export type WebhookWorkerStartResult = {
    started: true;
} | {
    started: false;
    error: string;
};
/**
 * In-memory guard (processPendingDeliveriesRunning) is process-local only. Cross-instance safety relies on
 * claim_pending_webhook_deliveries RPC's FOR UPDATE SKIP LOCKED — multiple worker instances may run; each claims rows atomically.
 * Returns a typed result so the caller can treat startup failure as degraded (log, telemetry) without exiting the process.
 */
export declare function startWebhookDeliveryWorker(): Promise<WebhookWorkerStartResult>;
export declare function stopWebhookDeliveryWorker(): void;
export {};
//# sourceMappingURL=webhookDelivery.d.ts.map