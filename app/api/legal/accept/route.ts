import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const LEGAL_VERSION = process.env.LEGAL_VERSION || '2025-12-riskmate-terms'

function getClientIp(headers: Headers): string | undefined {
  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim()
  }

  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  return undefined
}

export async function POST(request: NextRequest) {
  try {
    // Try to get token from Authorization header first (client-side sends this)
    const authHeader = request.headers.get('authorization')
    let user = null
    let authError = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // Validate token with Supabase
      const supabase = await createSupabaseServerClient()
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      user = tokenUser
      authError = tokenError
    } else {
      // Fallback to cookie-based auth
      const supabase = await createSupabaseServerClient()
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
      user = cookieUser
      authError = cookieError
    }

    if (authError || !user) {
      return NextResponse.json(
        { 
          message: 'Your session has expired. Please refresh the page and try again.',
          code: 'AUTH_UNAUTHORIZED'
        },
        { status: 401 }
      )
    }

    const supabase = await createSupabaseServerClient()

    // Get user's organization_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const ipAddress = getClientIp(request.headers) || undefined

    // Upsert legal acceptance
    const { data, error } = await supabase
      .from('legal_acceptances')
      .upsert(
        {
          user_id: user.id,
          organization_id: userData.organization_id,
          version: LEGAL_VERSION,
          ip_address: ipAddress ?? null,
        },
        { onConflict: 'user_id,version' }
      )
      .select('accepted_at')
      .single()

    if (error) {
      console.error('Legal acceptance upsert failed:', error)
      return NextResponse.json(
        { message: 'Failed to record legal acceptance' },
        { status: 500 }
      )
    }

    // Record audit log
    try {
      await supabase.from('audit_logs').insert({
        organization_id: userData.organization_id,
        actor_id: user.id,
        event_name: 'legal.accepted',
        target_type: 'legal',
        metadata: {
          version: LEGAL_VERSION,
          ip_address: ipAddress ?? null,
        },
      })
    } catch (auditError) {
      // Don't fail the request if audit log fails
      console.warn('Failed to record audit log:', auditError)
    }

    return NextResponse.json({
      accepted: true,
      version: LEGAL_VERSION,
      accepted_at: data?.accepted_at ?? new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Legal acceptance failed:', error)
    return NextResponse.json(
      { message: 'Failed to record legal acceptance' },
      { status: 500 }
    )
  }
}

