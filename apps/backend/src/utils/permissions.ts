/**
 * Backend permission checks aligned with frontend contract (lib/utils/permissions.ts).
 * Only roles listed for a permission are allowed; keeps API and UI in sync.
 */

/** Owner-only; use for bulk delete. */
const JOBS_DELETE_ROLES = ["owner"];

/** Owner and admin; use for single-job delete. */
const JOBS_DELETE_SINGLE_ROLES = ["owner", "admin"];

export function hasJobsDeletePermission(role: string | undefined): boolean {
  return !!role && JOBS_DELETE_ROLES.includes(role);
}

export function canDeleteSingleJob(role: string | undefined): boolean {
  return !!role && JOBS_DELETE_SINGLE_ROLES.includes(role);
}
