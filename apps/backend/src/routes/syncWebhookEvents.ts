/**
 * Shared webhook event emission for sync routes (/batch and /resolve-conflict).
 * Keeps payload and event-type parity so both paths behave the same for integrations.
 */

import { deliverEvent } from "../workers/webhookDelivery";

const logTag = "[Sync] Webhook";

function valueChanged(a: unknown, b: unknown): boolean {
  const na = a === undefined || a === null ? null : a;
  const nb = b === undefined || b === null ? null : b;
  if (na === null && nb === null) return false;
  if (na === null || nb === null) return true;
  return String(na) !== String(nb);
}

/** Emit job.created. Used by batch create_job and resolve-conflict create_job. */
export function emitSyncJobCreated(
  organization_id: string,
  userId: string,
  job: { id: string },
  data: { client_name?: string; clientName?: string; job_type?: string; jobType?: string; location?: string; status?: string }
): void {
  const client_name = data.client_name ?? data.clientName ?? "";
  const job_type = data.job_type ?? data.jobType ?? "";
  const location = data.location ?? "";
  deliverEvent(organization_id, "job.created", {
    id: job.id,
    client_name,
    job_type,
    location,
    status: data.status ?? "draft",
    created_by: userId,
  }).catch((e) => console.warn(`${logTag} job.created enqueue failed:`, e));
}

/** Emit job.updated and optionally job.completed when status transitions to completed. Used by batch update_job and resolve-conflict update_job. */
export function emitSyncJobUpdated(
  organization_id: string,
  jobId: string,
  updatedJobRow: Record<string, unknown>,
  existing: Record<string, unknown> & { completed_at?: string | null },
  updates: Record<string, unknown>
): void {
  const hadActualChange = Object.keys(updates).some((k) =>
    valueChanged(updates[k], existing[k])
  );
  if (!hadActualChange) return;
  deliverEvent(organization_id, "job.updated", {
    id: jobId,
    ...updatedJobRow,
  }).catch((e) => console.warn(`${logTag} job.updated enqueue failed:`, e));
  const didTransitionToCompleted =
    updates.status === "completed" && (existing.completed_at ?? null) == null;
  if (didTransitionToCompleted) {
    deliverEvent(organization_id, "job.completed", {
      id: jobId,
      completed_at: (updatedJobRow.completed_at as string) ?? new Date().toISOString(),
      status: "completed",
    }).catch((e) => console.warn(`${logTag} job.completed enqueue failed:`, e));
  }
}

/** Emit job.deleted. Used by batch delete_job and resolve-conflict delete_job. */
export function emitSyncJobDeleted(
  organization_id: string,
  jobId: string,
  deleted_at: string,
  status: string
): void {
  deliverEvent(organization_id, "job.deleted", {
    id: jobId,
    deleted_at,
    status,
  }).catch((e) => console.warn(`${logTag} job.deleted enqueue failed:`, e));
}

/** Emit hazard.created. Used by batch create_hazard and resolve-conflict create_hazard. */
export function emitSyncHazardCreated(
  organization_id: string,
  inserted: { id: string; created_at?: string; updated_at?: string },
  jobId: string,
  title: string,
  description: string
): void {
  deliverEvent(organization_id, "hazard.created", {
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
export function emitSyncHazardUpdated(
  organization_id: string,
  updatedItem: {
    id: string;
    job_id?: string;
    title?: string;
    description?: string;
    done?: boolean;
    is_completed?: boolean;
    completed_at?: string | null;
    created_at?: string;
  }
): void {
  deliverEvent(organization_id, "hazard.updated", {
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
