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
import type { RequestHandler } from 'express';
export type AppRole = 'owner' | 'admin' | 'executive' | 'safety_lead' | 'member';
/** Single source of truth for role strings (DB, backend, iOS must match) */
export declare const ROLES: {
    readonly MEMBER: "member";
    readonly SAFETY_LEAD: "safety_lead";
    readonly EXECUTIVE: "executive";
    readonly ADMIN: "admin";
    readonly OWNER: "owner";
};
/** Hierarchy for "at least X" checks (higher number = more power) */
export declare const ROLE_HIERARCHY: Record<AppRole, number>;
/**
 * Returns true if the actor's role is at least minRole in the hierarchy.
 */
export declare function hasRoleAtLeast(actorRole: string | undefined, minRole: AppRole): boolean;
/**
 * Who can invite which role.
 * - Only Owner can invite/create Owner.
 * - Admin can invite Member, Safety Lead, Executive (not Owner).
 * - Safety Lead can invite Member only.
 */
export declare function canInviteRole(actorRole: string | undefined, targetRole: string): boolean;
/**
 * Only Owner can set or grant the Owner role.
 */
export declare function onlyOwnerCanSetOwner(actorRole: string | undefined, targetRole: string): boolean;
/**
 * Safety Lead must provide at least one scope filter (job_id, date range, or category).
 * Executive/Admin/Owner can export org-wide.
 */
export declare function safetyLeadMustHaveScope(filters: {
    job_id?: string;
    start_date?: string;
    end_date?: string;
    category?: string;
}): boolean;
/**
 * Express middleware: require the current user to have at least minRole.
 * Use after authenticate. Sends 401 if no user, 403 if insufficient role.
 * Returns RequestHandler so Express overloads match (no route casts needed).
 */
export declare function requireRole(minRole: AppRole): RequestHandler;
//# sourceMappingURL=rbac.d.ts.map