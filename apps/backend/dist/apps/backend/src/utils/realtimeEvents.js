"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitRealtimeEvent = emitRealtimeEvent;
exports.emitJobEvent = emitJobEvent;
exports.emitEvidenceEvent = emitEvidenceEvent;
exports.emitAuditEvent = emitAuditEvent;
const supabaseClient_1 = require("../lib/supabaseClient");
// Rate limiting state (in-memory, resets on server restart)
// In production, consider Redis for distributed rate limiting
const orgEventCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_EVENTS = 100; // Max 100 events per org per minute
/**
 * Check if org is rate limited and generate dedupe key if needed
 */
function checkRateLimit(organizationId, eventType, entityId) {
    const now = Date.now();
    const orgState = orgEventCounts.get(organizationId);
    // Reset window if expired
    if (!orgState || now - orgState.windowStart > RATE_LIMIT_WINDOW_MS) {
        orgEventCounts.set(organizationId, { count: 1, windowStart: now });
        return null; // No dedupe needed
    }
    // Increment count
    orgState.count++;
    // If over limit, generate dedupe key to coalesce events
    if (orgState.count > RATE_LIMIT_MAX_EVENTS) {
        // Generate dedupe key: "eventType:entityId:minuteBucket"
        const minuteBucket = Math.floor(now / (60 * 1000));
        const dedupeKey = `${eventType}:${entityId || "all"}:${minuteBucket}`;
        console.warn("[RealtimeEvents] Rate limit exceeded for org, using dedupe:", {
            organizationId,
            count: orgState.count,
            dedupeKey,
        });
        return dedupeKey;
    }
    return null; // No dedupe needed
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
async function emitRealtimeEvent(organizationId, eventType, entityType, entityId, payload, actorId, dedupeKey) {
    try {
        // Rate limiting check (coalesce if over limit)
        const rateLimitDedupeKey = checkRateLimit(organizationId, eventType, entityId);
        const finalDedupeKey = dedupeKey || rateLimitDedupeKey;
        // Cap payload size (2KB max - signals only, not state)
        const payloadStr = JSON.stringify(payload || {});
        if (payloadStr.length > 2048) {
            console.warn("[RealtimeEvents] Payload too large, truncating:", {
                eventType,
                originalSize: payloadStr.length,
            });
            // Truncate payload if too large (shouldn't happen, but safety)
            const truncated = JSON.parse(payloadStr);
            delete truncated.large_field; // Remove large fields
            payload = truncated;
        }
        // Use service role to bypass RLS (backend-only writes)
        const { error } = await supabaseClient_1.supabase.from("realtime_events").insert({
            organization_id: organizationId,
            event_type: eventType,
            entity_type: entityType,
            entity_id: entityId || null,
            payload: payload || {},
            dedupe_key: finalDedupeKey || null,
            created_by: actorId || null,
        });
        if (error) {
            // Log but don't throw - events are non-critical
            console.warn("[RealtimeEvents] Failed to emit event:", {
                eventType,
                entityType,
                entityId,
                error: error.message,
            });
        }
        else {
            console.log("[RealtimeEvents] ✅ Emitted:", eventType, entityId || "", finalDedupeKey ? `(deduped: ${finalDedupeKey})` : "");
        }
    }
    catch (err) {
        // Silent fail - events are best-effort, don't break main flow
        console.warn("[RealtimeEvents] Exception emitting event:", err?.message);
    }
}
/**
 * Emit job-related event
 */
async function emitJobEvent(organizationId, eventType, jobId, actorId, additionalPayload) {
    await emitRealtimeEvent(organizationId, eventType, "job", jobId, {
        job_id: jobId,
        ...additionalPayload,
    }, actorId);
}
/**
 * Emit evidence-related event
 */
async function emitEvidenceEvent(organizationId, eventType, documentId, jobId, actorId) {
    await emitRealtimeEvent(organizationId, eventType, "evidence", documentId, {
        job_id: jobId,
        document_id: documentId,
    }, actorId);
}
/**
 * Emit audit event
 */
async function emitAuditEvent(organizationId, eventId, jobId) {
    await emitRealtimeEvent(organizationId, "audit.appended", "audit", eventId, {
        event_id: eventId,
        ...(jobId && { job_id: jobId }),
    });
}
//# sourceMappingURL=realtimeEvents.js.map