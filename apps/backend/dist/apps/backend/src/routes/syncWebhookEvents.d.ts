/**
 * Shared webhook event emission for sync routes (/batch and /resolve-conflict).
 * Keeps payload and event-type parity so both paths behave the same for integrations.
 */
/** Emit job.created. Used by batch create_job and resolve-conflict create_job. */
export declare function emitSyncJobCreated(organization_id: string, userId: string, job: {
    id: string;
}, data: {
    client_name?: string;
    clientName?: string;
    job_type?: string;
    jobType?: string;
    location?: string;
    status?: string;
}): void;
/** Emit job.updated and optionally job.completed when status transitions to completed. Used by batch update_job and resolve-conflict update_job. */
export declare function emitSyncJobUpdated(organization_id: string, jobId: string, updatedJobRow: Record<string, unknown>, existing: Record<string, unknown> & {
    completed_at?: string | null;
}, updates: Record<string, unknown>): void;
/** Emit job.deleted. Used by batch delete_job and resolve-conflict delete_job. */
export declare function emitSyncJobDeleted(organization_id: string, jobId: string, deleted_at: string, status: string): void;
/** Emit hazard.created. Used by batch create_hazard and resolve-conflict create_hazard. */
export declare function emitSyncHazardCreated(organization_id: string, inserted: {
    id: string;
    created_at?: string;
    updated_at?: string;
}, jobId: string, title: string, description: string): void;
/** Emit hazard.updated. Call only for top-level hazard rows (hazard_id is null). Used by batch update_hazard and resolve-conflict update_hazard. */
export declare function emitSyncHazardUpdated(organization_id: string, updatedItem: {
    id: string;
    job_id?: string;
    title?: string;
    description?: string;
    done?: boolean;
    is_completed?: boolean;
    completed_at?: string | null;
    created_at?: string;
}): void;
//# sourceMappingURL=syncWebhookEvents.d.ts.map