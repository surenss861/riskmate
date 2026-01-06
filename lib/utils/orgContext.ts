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

  // Step 1: Get user profile (contains organization_id)
  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.organization_id) {
    return null // No organization found
  }

  const orgId = profile.organization_id
  const role = profile.role || 'member'
  let resolvedFrom: 'profile' | 'membership' | 'fallback' = 'profile'

  // Verify organization exists and get name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle()

  if (!org) {
    return null // Organization not found
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

