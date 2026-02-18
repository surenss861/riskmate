"use strict";
/**
 * Backend permission checks aligned with frontend contract (lib/utils/permissions.ts).
 * Only roles listed for a permission are allowed; keeps API and UI in sync.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasJobsDeletePermission = hasJobsDeletePermission;
const JOBS_DELETE_ROLES = ["owner"];
function hasJobsDeletePermission(role) {
    return !!role && JOBS_DELETE_ROLES.includes(role);
}
//# sourceMappingURL=permissions.js.map