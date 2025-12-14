import { NextRequest, NextResponse } from 'next/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'
import { getOrgEntitlements } from '@/lib/entitlements'

export const runtime = 'nodejs'

/**
 * GET /api/org/entitlements
 * Get current entitlements for the organization
 * 
 * Returns the same shape as backend entitlements object.
 * Used by UI to match backend state.
 */
export async function GET(request: NextRequest) {
  try {
    const { organization_id } = await getOrganizationContext()

    // Get entitlements (server-computed, single source of truth)
    const entitlements = await getOrgEntitlements(organization_id)

    return NextResponse.json({
      data: entitlements,
    })
  } catch (error: any) {
    console.error('Failed to fetch entitlements:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch entitlements',
        code: 'FETCH_FAILED',
      },
      { status: 500 }
    )
  }
}

