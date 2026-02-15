/**
 * Pure helpers for job activity feed filters (realtime and row matching).
 * No Supabase/client imports so tests can import this module without env.
 */

/** Channel ID for job activity. Must match subscribe route and eventSubscription. */
export function getJobActivityChannelId(organizationId: string, jobId: string): string {
  return `job-activity-${organizationId}-${jobId}`;
}

/** Build realtime filter string: valid PostgREST expression and(organization_id.eq..., or(and(target_type.eq.job,target_id.eq.jobId), metadata->>job_id.eq.jobId, job_id.eq.jobId)). Matches API route predicate. */
export function getJobActivityRealtimeFilter(organizationId: string, jobId: string): string {
  return `and(organization_id.eq.${organizationId},or(and(target_type.eq.job,target_id.eq.${jobId}),metadata->>job_id.eq.${jobId},job_id.eq.${jobId}))`;
}

/** True if this audit row belongs in the job activity feed (target is job, metadata.job_id = jobId, or audit_logs.job_id = jobId). */
export function isJobActivityRow(row: Record<string, unknown> | undefined, jobId: string): boolean {
  if (!row) return false;
  const isJobTarget = row.target_type === "job" && row.target_id === jobId;
  const hasJobIdInMetadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    (row.metadata as Record<string, unknown>).job_id === jobId;
  const hasJobIdColumn = row.job_id === jobId;
  return Boolean(isJobTarget || hasJobIdInMetadata || hasJobIdColumn);
}
