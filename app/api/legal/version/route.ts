import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const LEGAL_VERSION = process.env.LEGAL_VERSION || '2025-12-riskmate-terms'
const LEGAL_UPDATED_AT = process.env.LEGAL_UPDATED_AT || '2025-12-01T00:00:00.000Z'

export async function GET(request: NextRequest) {
  try {
    // Try to get token from Authorization header first (client-side sends this)
    const authHeader = request.headers.get('authorization')
    const supabase = await createSupabaseServerClient()
    let user = null
    let authError = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // Validate token with Supabase
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      user = tokenUser
      authError = tokenError
    } else {
      // Fallback to cookie-based auth
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

    return NextResponse.json({
      version: LEGAL_VERSION,
      updated_at: LEGAL_UPDATED_AT,
    })
  } catch (error: any) {
    console.error('Legal version fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch legal version' },
      { status: 500 }
    )
  }
}

