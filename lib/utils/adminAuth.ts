/**
 * Admin Authentication Utilities
 * 
 * Consistent admin/owner role checking across the codebase.
 * Use this instead of inline role checks to avoid "DB says yes, API says no" bugs.
 */

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
    throw new Error('Forbidden - Only owners and admins can access this resource')
  }
}

/**
 * Get user role from Supabase user record
 * Checks both users.role and organization_members.role
 */
export async function getUserRole(
  supabase: any,
  userId: string,
  organizationId?: string
): Promise<string | null> {
  // First check organization_members (if org provided)
  if (organizationId) {
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle()
    
    if (member?.role) {
      return member.role
    }
  }

  // Fallback to users.role
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return user?.role || null
}
