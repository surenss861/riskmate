/**
 * Admin Authentication Utilities
 * 
 * Consistent admin/owner role checking across the codebase.
 * Use this instead of inline role checks to avoid "DB says yes, API says no" bugs.
 */

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden - Only owners and admins can access this resource') {
    super(message)
    this.name = 'ForbiddenError'
    Object.setPrototypeOf(this, ForbiddenError.prototype)
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
    Object.setPrototypeOf(this, UnauthorizedError.prototype)
  }
}

/**
 * Check if a user role is admin or owner
 */
export function isAdminOrOwner(role: string | null | undefined): boolean {
  if (!role) return false
  return role === 'owner' || role === 'admin'
}

/**
 * Verify user is admin or owner, throw if not
 */
export function requireAdminOrOwner(role: string | null | undefined): void {
  if (!isAdminOrOwner(role)) {
    throw new ForbiddenError('Forbidden - Only owners and admins can access this resource')
  }
}

const ROLE_RANK: Record<string, number> = { owner: 3, admin: 2, member: 1 }

/**
 * Get user role from Supabase user record.
 * When organizationId is provided: role resolution is strictly organization-scoped.
 * Only organization_members.role for that org is considered; users.role is used as
 * fallback only when users.organization_id matches the same organizationId (prevents
 * global/admin in users.role from granting admin in other orgs).
 * When organizationId is omitted: returns the highest role across users.role and
 * organization_members (legacy/global context).
 */
export async function getUserRole(
  supabase: any,
  userId: string,
  organizationId?: string
): Promise<string | null> {
  let memberRole: string | null = null
  if (organizationId) {
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    memberRole = member?.role ?? null
  }

  const { data: user } = await supabase
    .from('users')
    .select('role, organization_id')
    .eq('id', userId)
    .maybeSingle()
  const userRole = user?.role ?? null
  const userOrgId = user?.organization_id ?? null

  // When organizationId is provided: only use users.role if it applies to this org
  const userRoleApplies =
    !organizationId ||
    userOrgId === organizationId

  const effectiveUserRole = userRoleApplies ? userRole : null
  const a = ROLE_RANK[memberRole ?? ''] ?? 0
  const b = ROLE_RANK[effectiveUserRole ?? ''] ?? 0
  if (a >= b && memberRole) return memberRole
  if (b >= a && effectiveUserRole) return effectiveUserRole
  return memberRole ?? effectiveUserRole ?? null
}
