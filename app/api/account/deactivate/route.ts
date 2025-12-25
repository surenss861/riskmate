import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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
    const { confirmation, reason, transfer_to_user_id } = body

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
      // Count other owners
      const { count: ownerCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'owner')
        .is('archived_at', null)
        .neq('id', user.id)

      // Count other members (non-owners)
      const { count: memberCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('archived_at', null)
        .neq('id', user.id)
        .neq('role', 'owner')

      // If this is the last owner
      if ((ownerCount ?? 0) === 0) {
        // Option A: If there are other members, require ownership transfer
        if ((memberCount ?? 0) > 0) {
          if (!transfer_to_user_id) {
            return NextResponse.json(
              {
                message: 'You are the last owner. Please transfer ownership to another member before deleting your account.',
                requires_transfer: true,
                available_members: memberCount,
              },
              { status: 400 }
            )
          }

          // Transfer ownership before deletion
          const { data: transferData, error: transferError } = await supabase.rpc(
            'transfer_team_ownership',
            {
              p_organization_id: organizationId,
              p_new_owner_user_id: transfer_to_user_id,
            }
          )

          if (transferError) {
            return NextResponse.json(
              {
                message: transferError.message || 'Failed to transfer ownership',
                code: transferError.code,
              },
              { status: 400 }
            )
          }
        }
        // Option B: If no other members exist, allow deletion (org will be effectively dissolved)
        // No transfer needed - proceed with deletion
      }
    }

    // Archive user account (soft delete)
    const { error: archiveError } = await supabase
      .from('users')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('archived_at', null)

    if (archiveError) {
      throw archiveError
    }

    // Use admin client to delete auth user (hard delete)
    // This requires service role key and bypasses RLS
    const adminClient = createSupabaseAdminClient()
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      // Log but don't fail - user is already archived in database
      console.error('Failed to delete auth user (user is archived):', deleteError)
      // Continue - the user is archived which is sufficient for deactivation
    }

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

