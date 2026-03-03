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

export const VALID_CLIENT_TYPES = [
  'residential',
  'commercial',
  'industrial',
  'government',
  'mixed',
] as const

export const VALID_CLIENT_TYPES_SET = new Set<string>(VALID_CLIENT_TYPES)

export const VALID_JOB_TYPES = [
  'repair',
  'maintenance',
  'installation',
  'inspection',
  'renovation',
  'new_construction',
  'remodel',
  'other',
] as const

export const VALID_JOB_TYPES_SET = new Set<string>(VALID_JOB_TYPES)
