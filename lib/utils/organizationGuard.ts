/**
 * Organization Guard Utilities
 * 
 * Ensures all database queries are properly scoped to the user's organization.
 * This provides defense-in-depth even if RLS policies are misconfigured.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface OrganizationContext {
  organization_id: string
  user_id: string
  user_role: string
}

/**
 * Get the authenticated user's organization context
 * Throws if user is not authenticated or has no organization
 * 
 * Supports both Authorization header (Bearer token) and cookie-based auth
 */
export async function getOrganizationContext(request?: Request): Promise<OrganizationContext> {
  const supabase = await createSupabaseServerClient()
  let user = null
  let authError = null

  // Try Authorization header first (client-side sends this when using localStorage)
  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      user = tokenUser
      authError = tokenError
    }
  }

  // Fallback to cookie-based auth if no header or header auth failed
  if (!user && !authError) {
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    user = cookieUser
    authError = cookieError
  }

  if (authError || !user) {
    throw new Error('Unauthorized: User not authenticated')
  }

  // Use service role client for database queries (bypasses RLS)
  const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
  const serviceSupabase = createSupabaseAdminClient()

  const { data: userData, error: userError } = await serviceSupabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (userError) {
    console.error('[getOrganizationContext] User lookup error:', {
      userId: user.id.substring(0, 8),
      error: userError.message,
      code: userError.code
    })
    throw new Error('Failed to get organization ID')
  }

  if (!userData?.organization_id) {
    throw new Error('Failed to get organization ID: User has no organization')
  }

  return {
    organization_id: userData.organization_id,
    user_id: user.id,
    user_role: userData.role,
  }
}

/**
 * Verify that a resource belongs to the user's organization
 * Uses admin client to bypass RLS so cross-org access returns 403 instead of 404.
 * Throws if verification fails
 */
export async function verifyOrganizationOwnership(
  table: string,
  resourceId: string,
  organizationId: string
): Promise<boolean> {
  const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
  const adminSupabase = createSupabaseAdminClient()

  const { data, error } = await adminSupabase
    .from(table)
    .select('organization_id')
    .eq('id', resourceId)
    .maybeSingle()

  if (error) {
    throw new Error(`Resource not found: ${table}:${resourceId}`)
  }

  if (!data) {
    throw new Error(`Resource not found: ${table}:${resourceId}`)
  }

  if (data.organization_id !== organizationId) {
    throw new Error(`Access denied: Resource does not belong to your organization`)
  }

  return true
}

/**
 * Verify that a job belongs to the user's organization
 * This is a convenience wrapper for verifyOrganizationOwnership
 */
export async function verifyJobOwnership(
  jobId: string,
  organizationId: string
): Promise<boolean> {
  return verifyOrganizationOwnership('jobs', jobId, organizationId)
}

/**
 * Check if user has required role
 */
export function requireRole(
  userRole: string,
  allowedRoles: string[]
): void {
  if (!allowedRoles.includes(userRole)) {
    throw new Error(`Access denied: Requires one of: ${allowedRoles.join(', ')}`)
  }
}

/**
 * Check if user is owner or admin
 */
export function requireOwnerOrAdmin(userRole: string): void {
  requireRole(userRole, ['owner', 'admin'])
}

