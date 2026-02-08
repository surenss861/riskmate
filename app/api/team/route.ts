import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { limitsFor } from '@/lib/utils/planRules'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { logApiError } from '@/lib/utils/errorLogging'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

const ROUTE = '/api/team'

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)

  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      const { response, errorId } = createErrorResponse(
        'Unauthorized: Please log in to view team',
        'UNAUTHORIZED',
        { requestId, statusCode: 401 }
      )
      logApiError(401, 'UNAUTHORIZED', errorId, requestId, undefined, response.message, {
        category: 'auth', severity: 'warn', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 401,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
    }

    // Get user's organization_id and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      const { response, errorId } = createErrorResponse(
        'Failed to get organization ID',
        'QUERY_ERROR',
        { requestId, statusCode: 500 }
      )
      logApiError(500, 'QUERY_ERROR', errorId, requestId, userData?.organization_id, response.message, {
        category: 'internal', severity: 'error', route: ROUTE,
      })
      return NextResponse.json(response, {
        status: 500,
        headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
      })
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
    const requestId = getRequestId(request)
    const { response, errorId } = createErrorResponse(
      'Failed to load team',
      'QUERY_ERROR',
      {
        requestId,
        statusCode: 500,
        details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
      }
    )
    logApiError(500, 'QUERY_ERROR', errorId, requestId, undefined, response.message, {
      category: 'internal', severity: 'error', route: ROUTE,
      details: process.env.NODE_ENV === 'development' ? { detail: error?.message } : undefined,
    })
    return NextResponse.json(response, {
      status: 500,
      headers: { 'X-Request-ID': requestId, 'X-Error-ID': errorId },
    })
  }
}

