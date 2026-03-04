/**
 * GET /api/me/context
 *
 * Returns the authenticated user's organization-scoped context: effective role,
 * default organization_id, and full memberships list (for session bootstrap and org switcher).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContextWithMemberships } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { user_role, organization_id, memberships } = await getOrganizationContextWithMemberships(request)
    return NextResponse.json({
      user_role,
      organization_id,
      memberships: memberships ?? [],
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
