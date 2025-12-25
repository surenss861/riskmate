import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/auth/signout
 * 
 * Signs out the current user from all sessions (global signout)
 * Clears SSR cookies properly for Next.js App Router
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Sign out from all sessions (global is default)
    const { error } = await supabase.auth.signOut({
      scope: 'global', // Sign out from all devices/sessions
    })

    if (error) {
      console.error('Sign out error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to sign out' },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, message: 'Signed out successfully' })
  } catch (error: any) {
    console.error('Sign out route error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to sign out' },
      { status: 500 }
    )
  }
}

