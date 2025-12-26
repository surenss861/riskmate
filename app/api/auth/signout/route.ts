import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * POST /api/auth/signout
 * 
 * Signs out the current user from all sessions globally (all devices)
 * Uses admin client to properly revoke all sessions server-side
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    
    // Get current user before signing out
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const userId = user.id

    // Use admin client to globally revoke all sessions for this user
    // This is the proper way to sign out everywhere
    const adminClient = createSupabaseAdminClient()
    const { error: adminError } = await adminClient.auth.admin.signOut(userId, 'global')

    if (adminError) {
      console.error('Admin signOut failed:', adminError)
      // Fallback to regular signOut if admin fails
      const { error } = await supabase.auth.signOut({
        scope: 'global',
      })

      if (error) {
        return NextResponse.json(
          { error: error.message || 'Failed to sign out' },
          { status: 400 }
        )
      }
    } else {
      // Also clear local session cookies
      await supabase.auth.signOut({
        scope: 'global',
      })
    }

    return NextResponse.json({ ok: true, message: 'Signed out from all sessions' })
  } catch (error: any) {
    console.error('Sign out route error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to sign out' },
      { status: 500 }
    )
  }
}
