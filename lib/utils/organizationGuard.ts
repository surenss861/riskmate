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
 */
export async function getOrganizationContext(): Promise<OrganizationContext> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized: User not authenticated')
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (userError || !userData?.organization_id) {
    throw new Error('Failed to get organization ID')
  }

  return {
    organization_id: userData.organization_id,
    user_id: user.id,
    user_role: userData.role,
  }
}

/**
 * Verify that a resource belongs to the user's organization
 * Throws if verification fails
 */
export async function verifyOrganizationOwnership(
  table: string,
  resourceId: string,
  organizationId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from(table)
    .select('organization_id')
    .eq('id', resourceId)
    .single()

  if (error || !data) {
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

