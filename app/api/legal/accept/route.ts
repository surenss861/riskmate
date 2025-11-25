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
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    const ipAddress = getClientIp(request.headers) || request.ip || undefined

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

