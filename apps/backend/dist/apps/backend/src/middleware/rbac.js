"use strict";
/**
 * RBAC: Role-Based Access Control for Riskmate
 *
 * Roles: owner > admin > executive > safety_lead > member
 * Principle: Separate "doing" from "approving" from "governing".
 *
 * - Member = do the work (create jobs, upload evidence, complete controls)
 * - Safety Lead = validate the work (review/approve, readiness)
 * - Executive = visibility + exports (read-only dashboards + audit packages)
 * - Admin = configure + manage (settings, templates, team)
 * - Owner = god mode (billing, org ownership, deletions, role grants)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_HIERARCHY = exports.ROLES = void 0;
exports.hasRoleAtLeast = hasRoleAtLeast;
exports.canInviteRole = canInviteRole;
exports.onlyOwnerCanSetOwner = onlyOwnerCanSetOwner;
exports.safetyLeadMustHaveScope = safetyLeadMustHaveScope;
exports.requireRole = requireRole;
/** Single source of truth for role strings (DB, backend, iOS must match) */
exports.ROLES = {
    MEMBER: 'member',
    SAFETY_LEAD: 'safety_lead',
    EXECUTIVE: 'executive',
    ADMIN: 'admin',
    OWNER: 'owner',
};
/** Hierarchy for "at least X" checks (higher number = more power) */
exports.ROLE_HIERARCHY = {
    owner: 5,
    admin: 4,
    executive: 3,
    safety_lead: 2,
    member: 1,
};
function toAppRole(raw) {
    if (!raw || typeof raw !== 'string')
        return 'member';
    const r = raw.toLowerCase();
    if (r === 'owner' || r === 'admin' || r === 'executive' || r === 'safety_lead' || r === 'member') {
        return r;
    }
    return 'member';
}
/**
 * Returns true if the actor's role is at least minRole in the hierarchy.
 */
function hasRoleAtLeast(actorRole, minRole) {
    const actor = toAppRole(actorRole);
    return exports.ROLE_HIERARCHY[actor] >= exports.ROLE_HIERARCHY[minRole];
}
/**
 * Who can invite which role.
 * - Only Owner can invite/create Owner.
 * - Admin can invite Member, Safety Lead, Executive (not Owner).
 * - Safety Lead can invite Member only.
 */
function canInviteRole(actorRole, targetRole) {
    const actor = toAppRole(actorRole);
    const target = targetRole?.toLowerCase();
    if (target === 'owner') {
        return actor === 'owner';
    }
    if (actor === 'owner') {
        return true;
    }
    if (actor === 'admin') {
        return target === 'member' || target === 'safety_lead' || target === 'executive';
    }
    if (actor === 'safety_lead') {
        return target === 'member';
    }
    return false;
}
/**
 * Only Owner can set or grant the Owner role.
 */
function onlyOwnerCanSetOwner(actorRole, targetRole) {
    if (targetRole?.toLowerCase() !== 'owner')
        return true;
    return toAppRole(actorRole) === 'owner';
}
/**
 * Safety Lead must provide at least one scope filter (job_id, date range, or category).
 * Executive/Admin/Owner can export org-wide.
 */
function safetyLeadMustHaveScope(filters) {
    const { job_id, start_date, end_date, category } = filters;
    return !!(job_id || (start_date && end_date) || category);
}
/**
 * Express middleware: require the current user to have at least minRole.
 * Use after authenticate. Sends 401 if no user, 403 if insufficient role.
 * Returns RequestHandler so Express overloads match (no route casts needed).
 */
function requireRole(minRole) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role) {
            res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
            return;
        }
        if (!hasRoleAtLeast(role, minRole)) {
            res.status(403).json({
                message: 'Insufficient permissions',
                code: 'AUTH_ROLE_FORBIDDEN',
                required_role: minRole,
                current_role: role ?? 'member',
            });
            return;
        }
        next();
    };
}
//# sourceMappingURL=rbac.js.map