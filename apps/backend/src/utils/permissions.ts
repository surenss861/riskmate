/**
 * Backend permission checks aligned with frontend contract (lib/utils/permissions.ts).
 * Only roles listed for a permission are allowed; keeps API and UI in sync.
 */

const JOBS_DELETE_ROLES = ["owner"];

export function hasJobsDeletePermission(role: string | undefined): boolean {
  return !!role && JOBS_DELETE_ROLES.includes(role);
}
