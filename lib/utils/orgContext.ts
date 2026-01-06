/**
 * Organization Context Resolution
 * Shared helper for resolving authenticated user's organization context
 * Ensures consistent org scoping across all API routes
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'

export interface OrgContext {
  userId: string
  orgId: string
  orgName: string
  role: string
  resolvedFrom: 'profile' | 'membership' | 'fallback'
}

/**
 * Resolve organization context for authenticated user
 * 
 * Resolution order:
 * 1. Check user profile for active_org_id
 * 2. Check org_members for most recent membership
 * 3. Fallback to first org if user has any membership
 * 
 * Verifies membership and role before returning context.
 */
export async function resolveOrgContext(user: User): Promise<OrgContext | null> {
  const supabase = await createSupabaseServerClient()
  const userId = user.id

  // Step 1: Check user profile for active_org_id
  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role, active_org_id')
    .eq('id', userId)
    .maybeSingle()

  let orgId: string | null = null
  let role: string | null = null
  let resolvedFrom: 'profile' | 'membership' | 'fallback' = 'fallback'

  // Try active_org_id first (if profile has it)
  if (profile?.active_org_id) {
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', userId)
      .eq('org_id', profile.active_org_id)
      .maybeSingle()

    if (membership) {
      orgId = membership.org_id
      role = membership.role || profile.role || 'member'
      resolvedFrom = 'profile'
    }
  }

  // Step 2: If no active_org_id, check org_members for most recent
  if (!orgId) {
    const { data: memberships } = await supabase
      .from('org_members')
      .select('org_id, role, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (memberships && memberships.length > 0) {
      orgId = memberships[0].org_id
      role = memberships[0].role || profile?.role || 'member'
      resolvedFrom = 'membership'
    } else if (profile?.organization_id) {
      // Step 3: Fallback to organization_id from profile
      orgId = profile.organization_id
      role = profile.role || 'member'
      resolvedFrom = 'fallback'
    }
  }

  if (!orgId) {
    return null // No organization found
  }

  // Verify membership exists (security check)
  const { data: membershipCheck } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!membershipCheck) {
    // User doesn't have membership - return null
    return null
  }

  // Get organization name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()

  if (!org) {
    return null // Organization not found
  }

  return {
    userId,
    orgId,
    orgName: org.name || 'Organization',
    role: role || membershipCheck.role || 'member',
    resolvedFrom,
  }
}

/**
 * Hash an ID for safe logging (no PII exposure)
 */
export function hashId(id: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(id).digest('hex').substring(0, 8)
}

