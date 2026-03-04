/**
 * Organization Guard Utilities
 * 
 * Ensures all database queries are properly scoped to the user's organization.
 * This provides defense-in-depth even if RLS policies are misconfigured.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { UnauthorizedError, ForbiddenError } from '@/lib/utils/adminAuth'

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

  // Try Authorization header first (client-side sends this when using localStorage).
  // Parse bearer case-insensitively per HTTP auth scheme rules (RFC 7235).
  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const parts = authHeader.trim().split(/\s+/, 2)
      if (parts.length >= 2 && parts[0].toLowerCase() === 'bearer') {
        const token = parts[1]
        const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
        user = tokenUser
        authError = tokenError
      }
    }
  }

  // Fallback to cookie-based auth if no header or header auth failed
  if (!user && !authError) {
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    user = cookieUser
    authError = cookieError
  }

  if (authError || !user) {
    throw new UnauthorizedError('Unauthorized: User not authenticated')
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

  const headerOrgId = request?.headers?.get?.('x-organization-id')?.trim() ?? ''
  let queryOrgId = ''
  if (request?.url) {
    try {
      queryOrgId = new URL(request.url).searchParams.get('organization_id')?.trim() ?? ''
    } catch {
      // ignore URL parse errors
    }
  }
  const requestedOrgId = headerOrgId || queryOrgId

  let organization_id: string
  if (requestedOrgId) {
    // Honor explicit selector: validate against organization_members; legacy fallback when memberships empty
    const { data: memberRows, error: memberError } = await serviceSupabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .order('organization_id', { ascending: true })
    if (memberError || !memberRows?.length) {
      // Legacy: allow requestedOrgId only when users.organization_id exists and equals requestedOrgId
      const userOrgId = userData?.organization_id ?? null
      if (userOrgId && userOrgId === requestedOrgId) {
        organization_id = requestedOrgId
      } else {
        throw new ForbiddenError('User has no organization membership')
      }
    } else {
      const membership = memberRows.find((m) => m.organization_id === requestedOrgId)
      if (!membership) {
        throw new ForbiddenError('The specified organization is not one of your memberships.')
      }
      organization_id = membership.organization_id
    }
  } else {
    // No selector: keep current fallback (users.organization_id, then single/multi membership)
    organization_id = userData?.organization_id ?? null
    if (!organization_id) {
      const { data: memberRows, error: memberError } = await serviceSupabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .order('organization_id', { ascending: true })
      if (memberError || !memberRows?.length) {
        throw new ForbiddenError('User has no organization membership')
      }
      if (memberRows.length === 1) {
        organization_id = memberRows[0].organization_id
      } else {
        throw new ForbiddenError(
          'User belongs to multiple organizations. Provide X-Organization-Id header or organization_id query parameter.'
        )
      }
    }
  }

  // Resolve effective role for this org. Only consider users.role when it applies to
  // this organization (users.organization_id === organization_id). Otherwise derive
  // privilege strictly from organization_members.role for this org to avoid elevating
  // a user who is owner/admin in another org but only member in the active org.
  const { data: memberRow } = await serviceSupabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organization_id)
    .maybeSingle()
  const memberRole = (memberRow?.role as string) ?? null
  const userRole = userData?.role ?? 'member'
  const userOrgId = userData?.organization_id ?? null
  const user_role =
    userOrgId === organization_id
      ? (memberRole === 'owner' || userRole === 'owner'
          ? 'owner'
          : memberRole === 'admin' || userRole === 'admin'
            ? 'admin'
            : (memberRole ?? userRole))
      : (memberRole ?? 'member')

  return {
    organization_id,
    user_id: user.id,
    user_role,
  }
}

export interface OrganizationContextWithMemberships extends OrganizationContext {
  /** All organizations the user belongs to (for multi-org selector and bootstrap). */
  memberships: { id: string; name: string }[]
}

/**
 * Get organization context plus full memberships list (for session bootstrap and org switcher).
 * Does not require an already-selected organization: authenticates the user, fetches all memberships,
 * and derives an effective/default organization_id (users.organization_id when in memberships, else
 * deterministic first membership). Use this for bootstrap/context; use getOrganizationContext() for
 * request paths that mutate/read tenant-scoped data (those still enforce explicit org selection when multi-membership).
 */
export async function getOrganizationContextWithMemberships(request?: Request): Promise<OrganizationContextWithMemberships> {
  const supabase = await createSupabaseServerClient()
  let user = null
  let authError = null

  if (request) {
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const parts = authHeader.trim().split(/\s+/, 2)
      if (parts.length >= 2 && parts[0].toLowerCase() === 'bearer') {
        const token = parts[1]
        const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
        user = tokenUser
        authError = tokenError
      }
    }
  }

  if (!user && !authError) {
    const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
    user = cookieUser
    authError = cookieError
  }

  if (authError || !user) {
    throw new UnauthorizedError('Unauthorized: User not authenticated')
  }

  const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
  const serviceSupabase = createSupabaseAdminClient()

  const { data: userData, error: userError } = await serviceSupabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (userError) {
    console.error('[getOrganizationContextWithMemberships] User lookup error:', {
      userId: user.id.substring(0, 8),
      error: userError.message,
      code: userError.code
    })
    throw new Error('Failed to get organization ID')
  }

  const { data: memberRows, error: memberError } = await serviceSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('organization_id', { ascending: true })

  // Legacy compatibility: when organization_members is empty but users.organization_id is present,
  // treat that org as a valid membership (e.g. invite/legacy provisioning without organization_members row).
  const userOrgIdFromTable = userData?.organization_id ?? null
  let orgIds: string[]
  if (memberError) {
    throw new ForbiddenError('User has no organization membership')
  }
  if (memberRows?.length) {
    orgIds = Array.from(new Set((memberRows ?? []).map((r: { organization_id: string }) => r.organization_id).filter(Boolean))).sort()
  } else if (userOrgIdFromTable) {
    orgIds = [userOrgIdFromTable]
  } else {
    throw new ForbiddenError('User has no organization membership')
  }
  if (orgIds.length === 0) {
    throw new ForbiddenError('User has no organization membership')
  }

  const { data: orgRows } = await serviceSupabase
    .from('organizations')
    .select('id, name')
    .in('id', orgIds)
  const byId = new Map((orgRows ?? []).map((r: { id: string; name: string | null }) => [r.id, r.name ?? r.id]))
  const memberships = orgIds.map((id) => ({ id, name: byId.get(id) ?? id }))

  const userOrgId = userData?.organization_id ?? null
  const inMemberships = userOrgId && orgIds.includes(userOrgId)
  // Honor explicit org selector for role derivation (e.g. navbar / org switcher).
  const headerOrgId = request?.headers?.get?.('x-organization-id')?.trim() ?? ''
  let queryOrgId = ''
  if (request?.url) {
    try {
      queryOrgId = new URL(request.url).searchParams.get('organization_id')?.trim() ?? ''
    } catch {
      // ignore URL parse errors
    }
  }
  const requestedOrgId = headerOrgId || queryOrgId
  const organization_id =
    requestedOrgId && orgIds.includes(requestedOrgId)
      ? requestedOrgId
      : inMemberships
        ? userOrgId
        : orgIds[0]

  const { data: memberRow } = await serviceSupabase
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organization_id)
    .maybeSingle()
  const memberRole = (memberRow?.role as string) ?? null
  const userRole = userData?.role ?? 'member'
  const user_role =
    userOrgId === organization_id
      ? (memberRole === 'owner' || userRole === 'owner'
          ? 'owner'
          : memberRole === 'admin' || userRole === 'admin'
            ? 'admin'
            : (memberRole ?? userRole))
      : (memberRole ?? 'member')

  return {
    organization_id,
    user_id: user.id,
    user_role,
    memberships,
  }
}

/**
 * Webhook-specific org context aligned with webhook_user_org_ids().
 * Returns all org IDs the user belongs to (users.organization_id + organization_members)
 * so /api/webhooks/* can allow access when the endpoint belongs to any of those orgs.
 */
export interface WebhookOrganizationContext extends OrganizationContext {
  organization_ids: string[]
}

export async function getWebhookOrganizationContext(request?: Request): Promise<WebhookOrganizationContext> {
  const base = await getOrganizationContext(request)
  const { createSupabaseAdminClient } = await import('@/lib/supabase/admin')
  const serviceSupabase = createSupabaseAdminClient()

  const orgIds = new Set<string>([base.organization_id])
  const { data: memberRows } = await serviceSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', base.user_id)
  for (const row of memberRows ?? []) {
    if (row.organization_id) orgIds.add(row.organization_id)
  }

  // Deterministic ordering for fallback only; callers must use explicit org selection when multiple orgs exist.
  return {
    ...base,
    organization_ids: Array.from(orgIds).sort(),
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

/** Allowed comment entity types (ticket scope); table names for ownership checks. */
export const COMMENT_ENTITY_TYPES = [
  'job',
  'hazard',
  'control',
  'photo',
] as const
export type CommentEntityType = (typeof COMMENT_ENTITY_TYPES)[number]

const ENTITY_TYPE_TO_TABLE: Record<CommentEntityType, string> = {
  job: 'jobs',
  hazard: 'hazards',
  control: 'controls',
  photo: 'job_photos',
}

/**
 * Verify that an entity (job, hazard, control, etc.) belongs to the user's organization.
 * Use for comment list/create per entity_type + entity_id.
 */
export async function verifyEntityOwnership(
  entityType: CommentEntityType,
  entityId: string,
  organizationId: string
): Promise<boolean> {
  const table = ENTITY_TYPE_TO_TABLE[entityType]
  if (!table) {
    throw new Error(`Invalid entity_type: ${entityType}`)
  }
  return verifyOrganizationOwnership(table, entityId, organizationId)
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

