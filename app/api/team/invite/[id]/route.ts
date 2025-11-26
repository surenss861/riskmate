import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
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
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    if (!['owner', 'admin'].includes(userData.role ?? '')) {
      return NextResponse.json(
        { message: 'Only admins can revoke invites' },
        { status: 403 }
      )
    }

    const { id: inviteId } = await params
    const organizationId = userData.organization_id

    // Get invite
    const { data: inviteRow, error: inviteFetchError } = await supabase
      .from('organization_invites')
      .select('user_id')
      .eq('id', inviteId)
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .maybeSingle()

    if (inviteFetchError) {
      throw inviteFetchError
    }

    // Delete user if exists
    if (inviteRow?.user_id) {
      await supabase
        .from('users')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', inviteRow.user_id)

      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (supabaseUrl && serviceRoleKey) {
          const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
          await adminSupabase.auth.admin.deleteUser(inviteRow.user_id)
        }
      } catch (adminDeleteError: any) {
        console.warn('Supabase user deletion failed:', adminDeleteError?.message)
      }
    }

    // Revoke invite
    const { error: revokeError } = await supabase
      .from('organization_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('organization_id', organizationId)
      .is('accepted_at', null)

    if (revokeError) {
      throw revokeError
    }

    return NextResponse.json({ status: 'revoked' })
  } catch (error: any) {
    console.error('Invite revoke failed:', error)
    return NextResponse.json(
      { message: 'Failed to revoke invite' },
      { status: 500 }
    )
  }
}

