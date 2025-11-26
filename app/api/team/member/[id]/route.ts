import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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
        { message: 'Only owners and admins can remove teammates' },
        { status: 403 }
      )
    }

    const { id: memberId } = await params

    if (user.id === memberId) {
      return NextResponse.json(
        { message: 'You cannot remove yourself.' },
        { status: 400 }
      )
    }

    const organizationId = userData.organization_id

    // Check if target member is an owner
    const { data: targetMember, error: targetError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .maybeSingle()

    if (targetError) {
      throw targetError
    }

    if (!targetMember) {
      return NextResponse.json(
        { message: 'Teammate not found' },
        { status: 404 }
      )
    }

    // Prevent removing owners unless there are multiple
    if (targetMember.role === 'owner') {
      if (userData.role !== 'owner') {
        return NextResponse.json(
          { message: 'Only owners can remove other owners' },
          { status: 403 }
        )
      }

      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('role', 'owner')
        .is('archived_at', null)

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          {
            message: 'Cannot remove the last owner. Transfer ownership or add another owner first.',
          },
          { status: 400 }
        )
      }
    }

    // Archive member
    const { error } = await supabase
      .from('users')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .is('archived_at', null)

    if (error) {
      throw error
    }

    return NextResponse.json({ status: 'removed' })
  } catch (error: any) {
    console.error('Member removal failed:', error)
    return NextResponse.json(
      { message: 'Failed to remove teammate' },
      { status: 500 }
    )
  }
}

