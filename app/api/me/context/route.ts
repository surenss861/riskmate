/**
 * GET /api/me/context
 *
 * Returns the authenticated user's organization-scoped context, including
 * effective role (from getOrganizationContext). Use for nav gating and UI
 * so dashboard visibility matches backend authorization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { user_role } = await getOrganizationContext(request)
    return NextResponse.json({ user_role })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
