/**
 * Shared job constants for Public API v1, aligned with DB CHECK constraints
 * (see supabase/migrations/20260340000000_jobs_enum_constraints_api_contract.sql).
 * Used by POST (create) and PATCH (update) so create/update semantics stay consistent.
 */
export const VALID_JOB_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'archived',
] as const

export const VALID_JOB_STATUSES_SET = new Set<string>(VALID_JOB_STATUSES)
