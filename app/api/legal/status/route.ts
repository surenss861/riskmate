import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const LEGAL_VERSION = process.env.LEGAL_VERSION || '2025-12-riskmate-terms'

export async function GET(request: NextRequest) {
  try {
    // Step 1: Verify auth token (use anon client for auth verification only)
    const authHeader = request.headers.get('authorization')
    const authClient = await createSupabaseServerClient()
    let user = null
    let authError = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user: tokenUser }, error: tokenError } = await authClient.auth.getUser(token)
      user = tokenUser
      authError = tokenError
    } else {
      // Fallback to cookie-based auth
      const { data: { user: cookieUser }, error: cookieError } = await authClient.auth.getUser()
      user = cookieUser
      authError = cookieError
    }

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Step 2: Use SERVICE ROLE client for database query (bypasses RLS)
    const serviceSupabase = createSupabaseAdminClient()

    // Check if user has accepted the current version
    const { data: acceptance, error: queryError } = await serviceSupabase
      .from('legal_acceptances')
      .select('accepted_at')
      .eq('user_id', user.id)
      .eq('version', LEGAL_VERSION)
      .maybeSingle()

    if (queryError) {
      console.error('[LEGAL_STATUS] Query failed', { 
        userId: user.id.substring(0, 8),
        error: queryError.message,
        code: queryError.code
      })
      // Don't fail - just return not accepted
      return NextResponse.json({
        accepted: false,
        accepted_at: null,
        version: LEGAL_VERSION,
      })
    }

    return NextResponse.json({
      accepted: !!acceptance,
      accepted_at: acceptance?.accepted_at ?? null,
      version: LEGAL_VERSION,
    })
  } catch (error: any) {
    console.error('[LEGAL_STATUS] Unexpected error', { 
      message: error?.message,
      stack: error?.stack 
    })
    return NextResponse.json(
      { 
        message: 'Failed to fetch legal status',
        code: 'LEGAL_STATUS_ERROR',
        error: error?.message
      },
      { status: 500 }
    )
  }
}

