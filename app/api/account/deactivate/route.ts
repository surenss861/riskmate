import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

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

    const body = await request.json()
    const { confirmation, reason } = body

    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { message: 'Invalid confirmation. Please type DELETE to confirm.' },
        { status: 400 }
      )
    }

    // Get user's organization_id and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get user data' },
        { status: 500 }
      )
    }

    const organizationId = userData.organization_id

    // Check if user is the last owner
    if (userData.role === 'owner') {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'owner')
        .is('archived_at', null)
        .neq('id', user.id)

      if ((count ?? 0) === 0) {
        return NextResponse.json(
          {
            message: 'Cannot deactivate the last owner. Transfer ownership or add another owner first.',
          },
          { status: 400 }
        )
      }
    }

    // Archive user account
    const { error: archiveError } = await supabase
      .from('users')
      .update({ 
        archived_at: new Date().toISOString(),
        account_status: 'deactivated'
      })
      .eq('id', user.id)
      .is('archived_at', null)

    if (archiveError) {
      // Try without account_status if column doesn't exist
      const { error: retryError } = await supabase
        .from('users')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', user.id)
        .is('archived_at', null)

      if (retryError) {
        throw retryError
      }
    }

    // Optionally delete auth user (or mark as disabled)
    // For now, we'll just archive the user record
    // The auth user can be deleted separately if needed

    return NextResponse.json({ 
      message: 'Account deactivated successfully',
      retention_days: 30
    })
  } catch (error: any) {
    console.error('Account deactivation failed:', error)
    return NextResponse.json(
      { 
        message: error?.message || 'Failed to deactivate account',
        code: error?.code,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}

