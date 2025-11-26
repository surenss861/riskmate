import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/utils/planRules'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
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

    const organizationId = userData.organization_id

    // Get organization subscription info
    const { data: orgSub } = await supabase
      .from('org_subscriptions')
      .select('plan_code, seats_limit')
      .eq('organization_id', organizationId)
      .maybeSingle()

    const plan = (orgSub?.plan_code || 'starter') as 'starter' | 'pro' | 'business'
    const seatLimit = orgSub?.seats_limit ?? limitsFor(plan).seats ?? null

    // Get members
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at, must_reset_password')
      .eq('organization_id', organizationId)
      .is('archived_at', null)
      .order('created_at', { ascending: true })

    if (membersError) {
      throw membersError
    }

    // Get invites
    const { data: invites, error: invitesError } = await supabase
      .from('organization_invites')
      .select('id, email, role, created_at, invited_by, user_id')
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: true })

    if (invitesError) {
      throw invitesError
    }

    const activeMembers = members?.length ?? 0
    const pendingInvites = invites?.length ?? 0

    return NextResponse.json({
      members: members ?? [],
      invites: invites ?? [],
      seats: {
        limit: seatLimit,
        used: activeMembers,
        pending: pendingInvites,
        available: seatLimit === null ? null : Math.max(seatLimit - activeMembers, 0),
      },
      current_user_role: userData.role ?? 'member',
      plan,
    })
  } catch (error: any) {
    console.error('Team fetch failed:', error)
    return NextResponse.json(
      {
        message: 'Failed to load team',
        detail: error?.message ?? null,
      },
      { status: 500 }
    )
  }
}

