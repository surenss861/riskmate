/**
 * Realtime Events Helper
 *
 * Emits lightweight push signals to clients via Supabase Realtime.
 * Events are signals, not state - clients fetch latest data via REST on event.
 *
 * Production guardrails:
 * - Rate limiting per org (coalesce if > X events/min)
 * - Payload size cap (2KB max)
 * - Silent fail (non-blocking)
 */
export type RealtimeEventType = "job.created" | "job.updated" | "job.archived" | "job.deleted" | "job.flagged" | "evidence.uploaded" | "evidence.synced" | "evidence.verified" | "audit.appended" | "mitigation.completed" | "mitigation.reopened" | "export.ready" | "proof_pack.generated";
export type EntityType = "job" | "evidence" | "audit" | "mitigation" | "export" | "proof_pack";
export interface RealtimeEventPayload {
    job_id?: string;
    document_id?: string;
    event_id?: string;
    mitigation_id?: string;
    export_id?: string;
    [key: string]: unknown;
}
/**
 * Emit a realtime event (push signal)
 *
 * @param organizationId - Organization ID
 * @param eventType - Event type (e.g., "job.created")
 * @param entityType - Entity type (e.g., "job")
 * @param entityId - Entity ID (optional)
 * @param payload - Additional context (small JSON)
 * @param actorId - User ID who triggered the event (optional)
 */
export declare function emitRealtimeEvent(organizationId: string, eventType: RealtimeEventType, entityType: EntityType, entityId?: string | null, payload?: RealtimeEventPayload, actorId?: string | null, dedupeKey?: string | null): Promise<void>;
/**
 * Emit job-related event
 */
export declare function emitJobEvent(organizationId: string, eventType: "job.created" | "job.updated" | "job.archived" | "job.deleted" | "job.flagged", jobId: string, actorId?: string | null, additionalPayload?: RealtimeEventPayload): Promise<void>;
/**
 * Emit evidence-related event
 */
export declare function emitEvidenceEvent(organizationId: string, eventType: "evidence.uploaded" | "evidence.synced" | "evidence.verified", documentId: string, jobId: string, actorId?: string | null): Promise<void>;
/**
 * Emit audit event
 */
export declare function emitAuditEvent(organizationId: string, eventId: string, jobId?: string | null): Promise<void>;
//# sourceMappingURL=realtimeEvents.d.ts.map