"use strict";
/**
 * Backend permission checks aligned with frontend contract (lib/utils/permissions.ts).
 * Only roles listed for a permission are allowed; keeps API and UI in sync.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasJobsDeletePermission = hasJobsDeletePermission;
exports.canDeleteSingleJob = canDeleteSingleJob;
/** Owner-only; use for bulk delete. */
const JOBS_DELETE_ROLES = ["owner"];
/** Owner and admin; use for single-job delete. */
const JOBS_DELETE_SINGLE_ROLES = ["owner", "admin"];
function hasJobsDeletePermission(role) {
    return !!role && JOBS_DELETE_ROLES.includes(role);
}
function canDeleteSingleJob(role) {
    return !!role && JOBS_DELETE_SINGLE_ROLES.includes(role);
}
//# sourceMappingURL=permissions.js.map