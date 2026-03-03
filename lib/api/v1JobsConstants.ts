/**
 * Shared job constants for Public API v1, aligned with DB CHECK constraints
 * (see supabase/migrations/20260340000000_jobs_enum_constraints_api_contract.sql and
 * 20260345000000_jobs_status_include_on_hold.sql). Used by POST (create) and PATCH (update)
 * and kept in sync with bulk status flows (BulkStatusModal, bulk/shared.ts, Express jobs).
 */
export const VALID_JOB_STATUSES = [
  'draft',
  'pending',
  'in_progress',
  'on_hold',
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
