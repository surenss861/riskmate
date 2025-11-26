import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { limitsFor } from '@/lib/utils/planRules'
import crypto from 'crypto'

export const runtime = 'nodejs'

const ALLOWED_ROLES = new Set(['owner', 'admin', 'member'])

function generateTempPassword(length = 12) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length]
  }
  return password
}

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
        { message: 'Only admins can invite teammates' },
        { status: 403 }
      )
    }

    const { email, role = 'member' } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { message: 'Email is required' },
        { status: 400 }
      )
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { message: 'Invalid role selection' },
        { status: 400 }
      )
    }

    const organizationId = userData.organization_id
    const normalizedEmail = email.trim().toLowerCase()

    // Check seat limits
    const { data: orgSub } = await supabase
      .from('org_subscriptions')
      .select('plan_code, seats_limit')
      .eq('organization_id', organizationId)
      .maybeSingle()

    const plan = (orgSub?.plan_code || 'starter') as 'starter' | 'pro' | 'business'
    const seatLimit = orgSub?.seats_limit ?? limitsFor(plan).seats ?? null

    const { count: memberCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('archived_at', null)

    if (seatLimit !== null && (memberCount ?? 0) >= seatLimit) {
      return NextResponse.json(
        {
          message: 'Seat limit reached. Upgrade your plan to add more teammates.',
          code: 'SEAT_LIMIT_REACHED',
        },
        { status: 402 }
      )
    }

    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('email', normalizedEmail)
      .is('archived_at', null)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json(
        { message: 'That teammate is already part of your organization.' },
        { status: 409 }
      )
    }

    // Create user with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { message: 'Server configuration error' },
        { status: 500 }
      )
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const tempPassword = generateTempPassword(12)

    const { data: createdUser, error: createUserError } =
      await adminSupabase.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          invited_by: user.id,
          organization_id: organizationId,
        },
      })

    if (createUserError || !createdUser?.user) {
      if (createUserError?.message?.includes('already registered')) {
        return NextResponse.json(
          { message: 'That email already has a RiskMate account.' },
          { status: 409 }
        )
      }
      throw createUserError
    }

    const newUserId = createdUser.user.id

    // Insert user record
    const { error: insertUserError } = await supabase.from('users').insert({
      id: newUserId,
      email: normalizedEmail,
      organization_id: organizationId,
      role,
      must_reset_password: true,
      invited_by: user.id,
    })

    if (insertUserError) {
      await adminSupabase.auth.admin.deleteUser(newUserId)
      throw insertUserError
    }

    // Create invite record
    let inviteRow: any = null
    try {
      const { data: inviteData } = await supabase
        .from('organization_invites')
        .insert({
          organization_id: organizationId,
          email: normalizedEmail,
          role,
          invited_by: user.id,
          user_id: newUserId,
        })
        .select('id, email, role, created_at, user_id')
        .single()

      inviteRow = inviteData
    } catch (inviteInsertError: any) {
      console.warn('Invite row insert failed:', inviteInsertError?.message)
    }

    return NextResponse.json({
      data: inviteRow,
      temporary_password: tempPassword,
      seats_remaining:
        seatLimit === null
          ? null
          : Math.max(seatLimit - ((memberCount ?? 0) + 1), 0),
    })
  } catch (error: any) {
    console.error('Team invite failed:', error)
    return NextResponse.json(
      { message: 'Failed to send invite' },
      { status: 500 }
    )
  }
}

