import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const LEGAL_VERSION = process.env.LEGAL_VERSION || '2025-12-riskmate-terms'

export async function GET(request: NextRequest) {
  try {
    // Try to get token from Authorization header first (client-side sends this)
    const authHeader = request.headers.get('authorization')
    let user = null
    let authError = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // Validate token with Supabase
      const supabase = await createSupabaseServerClient()
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      user = tokenUser
      authError = tokenError
    } else {
      // Fallback to cookie-based auth
      const supabase = await createSupabaseServerClient()
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
      user = cookieUser
      authError = cookieError
    }

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has accepted the current version
    const { data: acceptance } = await supabase
      .from('legal_acceptances')
      .select('accepted_at')
      .eq('user_id', user.id)
      .eq('version', LEGAL_VERSION)
      .maybeSingle()

    return NextResponse.json({
      accepted: !!acceptance,
      accepted_at: acceptance?.accepted_at ?? null,
      version: LEGAL_VERSION,
    })
  } catch (error: any) {
    console.error('Legal status fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch legal status' },
      { status: 500 }
    )
  }
}

