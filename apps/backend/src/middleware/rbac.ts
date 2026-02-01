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

import { Response, NextFunction } from 'express'
import { AuthenticatedRequest } from './auth'

export type AppRole = 'owner' | 'admin' | 'executive' | 'safety_lead' | 'member'

/** Single source of truth for role strings (DB, backend, iOS must match) */
export const ROLES = {
  MEMBER: 'member',
  SAFETY_LEAD: 'safety_lead',
  EXECUTIVE: 'executive',
  ADMIN: 'admin',
  OWNER: 'owner',
} as const

/** Hierarchy for "at least X" checks (higher number = more power) */
export const ROLE_HIERARCHY: Record<AppRole, number> = {
  owner: 5,
  admin: 4,
  executive: 3,
  safety_lead: 2,
  member: 1,
}

function toAppRole(raw: string | undefined): AppRole {
  if (!raw || typeof raw !== 'string') return 'member'
  const r = raw.toLowerCase()
  if (r === 'owner' || r === 'admin' || r === 'executive' || r === 'safety_lead' || r === 'member') {
    return r as AppRole
  }
  return 'member'
}

/**
 * Returns true if the actor's role is at least minRole in the hierarchy.
 */
export function hasRoleAtLeast(actorRole: string | undefined, minRole: AppRole): boolean {
  const actor = toAppRole(actorRole)
  return ROLE_HIERARCHY[actor] >= ROLE_HIERARCHY[minRole]
}

/**
 * Who can invite which role.
 * - Only Owner can invite/create Owner.
 * - Admin can invite Member, Safety Lead, Executive (not Owner).
 * - Safety Lead can invite Member only.
 */
export function canInviteRole(actorRole: string | undefined, targetRole: string): boolean {
  const actor = toAppRole(actorRole)
  const target = targetRole?.toLowerCase()

  if (target === 'owner') {
    return actor === 'owner'
  }
  if (actor === 'owner') {
    return true
  }
  if (actor === 'admin') {
    return target === 'member' || target === 'safety_lead' || target === 'executive'
  }
  if (actor === 'safety_lead') {
    return target === 'member'
  }
  return false
}

/**
 * Only Owner can set or grant the Owner role.
 */
export function onlyOwnerCanSetOwner(actorRole: string | undefined, targetRole: string): boolean {
  if (targetRole?.toLowerCase() !== 'owner') return true
  return toAppRole(actorRole) === 'owner'
}

/**
 * Safety Lead must provide at least one scope filter (job_id, date range, or category).
 * Executive/Admin/Owner can export org-wide.
 */
export function safetyLeadMustHaveScope(filters: { job_id?: string; start_date?: string; end_date?: string; category?: string }): boolean {
  const { job_id, start_date, end_date, category } = filters
  return !!(job_id || (start_date && end_date) || category)
}

/**
 * Express middleware: require the current user to have at least minRole.
 * Use after authenticate. Sends 403 if insufficient.
 */
export function requireRole(minRole: AppRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (!hasRoleAtLeast(role, minRole)) {
      res.status(403).json({
        message: 'Insufficient permissions',
        code: 'AUTH_ROLE_FORBIDDEN',
        required_role: minRole,
        current_role: role ?? 'member',
      })
      return
    }
    next()
  }
}
