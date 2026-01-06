/**
 * GET /api/debug/whoami
 * Debug endpoint to verify auth + org resolution
 * Gated to admin/owner/executive roles only
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveOrgContext, hashId } from '@/lib/utils/orgContext'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized', error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Resolve organization context
    const orgContext = await resolveOrgContext(user)

    if (!orgContext) {
      return NextResponse.json(
        { 
          message: 'Organization not found',
          userIdHash: hashId(user.id),
          hasOrg: false,
        },
        { status: 403 }
      )
    }

    // Verify admin/owner/executive role
    if (orgContext.role !== 'executive' && orgContext.role !== 'owner' && orgContext.role !== 'admin') {
      return NextResponse.json(
        { 
          message: 'Access denied',
          userIdHash: hashId(user.id),
          role: orgContext.role,
        },
        { status: 403 }
      )
    }

    // Return debug info (hashed IDs, no PII)
    return NextResponse.json({
      message: 'OK',
      userIdHash: hashId(orgContext.userId),
      orgIdHash: hashId(orgContext.orgId),
      orgName: orgContext.orgName,
      role: orgContext.role,
      resolvedFrom: orgContext.resolvedFrom,
      hasOrg: true,
    })
  } catch (error: any) {
    console.error('[debug/whoami] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

