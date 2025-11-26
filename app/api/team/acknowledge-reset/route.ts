import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    await supabase
      .from('users')
      .update({ must_reset_password: false })
      .eq('id', user.id)

    await supabase
      .from('organization_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('accepted_at', null)

    return NextResponse.json({ status: 'ok' })
  } catch (error: any) {
    console.error('Reset acknowledgement failed:', error)
    return NextResponse.json(
      { message: 'Failed to acknowledge password reset' },
      { status: 500 }
    )
  }
}

