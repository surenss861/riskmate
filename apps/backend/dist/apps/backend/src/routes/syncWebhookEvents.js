"use strict";
/**
 * Shared webhook event emission for sync routes (/batch and /resolve-conflict).
 * Keeps payload and event-type parity so both paths behave the same for integrations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitSyncJobCreated = emitSyncJobCreated;
exports.emitSyncJobUpdated = emitSyncJobUpdated;
exports.emitSyncJobDeleted = emitSyncJobDeleted;
exports.emitSyncHazardCreated = emitSyncHazardCreated;
exports.emitSyncHazardUpdated = emitSyncHazardUpdated;
const webhookDelivery_1 = require("../workers/webhookDelivery");
const logTag = "[Sync] Webhook";
function valueChanged(a, b) {
    const na = a === undefined || a === null ? null : a;
    const nb = b === undefined || b === null ? null : b;
    if (na === null && nb === null)
        return false;
    if (na === null || nb === null)
        return true;
    return String(na) !== String(nb);
}
/** Emit job.created. Used by batch create_job and resolve-conflict create_job. */
function emitSyncJobCreated(organization_id, userId, job, data) {
    const client_name = data.client_name ?? data.clientName ?? "";
    const job_type = data.job_type ?? data.jobType ?? "";
    const location = data.location ?? "";
    (0, webhookDelivery_1.deliverEvent)(organization_id, "job.created", {
        id: job.id,
        client_name,
        job_type,
        location,
        status: data.status ?? "draft",
        created_by: userId,
    }).catch((e) => console.warn(`${logTag} job.created enqueue failed:`, e));
}
/** Emit job.updated and optionally job.completed when status transitions to completed. Used by batch update_job and resolve-conflict update_job. */
function emitSyncJobUpdated(organization_id, jobId, updatedJobRow, existing, updates) {
    const hadActualChange = Object.keys(updates).some((k) => valueChanged(updates[k], existing[k]));
    if (!hadActualChange)
        return;
    (0, webhookDelivery_1.deliverEvent)(organization_id, "job.updated", {
        id: jobId,
        ...updatedJobRow,
    }).catch((e) => console.warn(`${logTag} job.updated enqueue failed:`, e));
    const didTransitionToCompleted = updates.status === "completed" && (existing.completed_at ?? null) == null;
    if (didTransitionToCompleted) {
        (0, webhookDelivery_1.deliverEvent)(organization_id, "job.completed", {
            id: jobId,
            completed_at: updatedJobRow.completed_at ?? new Date().toISOString(),
            status: "completed",
        }).catch((e) => console.warn(`${logTag} job.completed enqueue failed:`, e));
    }
}
/** Emit job.deleted. Used by batch delete_job and resolve-conflict delete_job. */
function emitSyncJobDeleted(organization_id, jobId, deleted_at, status) {
    (0, webhookDelivery_1.deliverEvent)(organization_id, "job.deleted", {
        id: jobId,
        deleted_at,
        status,
    }).catch((e) => console.warn(`${logTag} job.deleted enqueue failed:`, e));
}
/** Emit hazard.created. Used by batch create_hazard and resolve-conflict create_hazard. */
function emitSyncHazardCreated(organization_id, inserted, jobId, title, description) {
    (0, webhookDelivery_1.deliverEvent)(organization_id, "hazard.created", {
        id: inserted.id,
        job_id: jobId,
        title,
        description: description ?? "",
        severity: "medium",
        status: "open",
        created_at: inserted.created_at ?? new Date().toISOString(),
        updated_at: inserted.updated_at ?? inserted.created_at ?? new Date().toISOString(),
    }).catch((e) => console.warn(`${logTag} hazard.created enqueue failed:`, e));
}
/** Emit hazard.updated. Call only for top-level hazard rows (hazard_id is null). Used by batch update_hazard and resolve-conflict update_hazard. */
function emitSyncHazardUpdated(organization_id, updatedItem) {
    (0, webhookDelivery_1.deliverEvent)(organization_id, "hazard.updated", {
        id: updatedItem.id,
        job_id: updatedItem.job_id ?? "",
        title: updatedItem.title ?? "",
        description: updatedItem.description ?? "",
        done: updatedItem.done,
        is_completed: updatedItem.is_completed,
        completed_at: updatedItem.completed_at,
        created_at: updatedItem.created_at,
    }).catch((e) => console.warn(`${logTag} hazard.updated enqueue failed:`, e));
}
//# sourceMappingURL=syncWebhookEvents.js.map