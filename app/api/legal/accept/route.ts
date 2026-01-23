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
    const supabase = await createSupabaseServerClient()
    let user = null
    let authError = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      // Validate token with Supabase
      const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(token)
      user = tokenUser
      authError = tokenError
    } else {
      // Fallback to cookie-based auth
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

    // Get user's organization_id - create default org if missing
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id, email, full_name')
      .eq('id', user.id)
      .maybeSingle()

    let organizationId: string | null = null

    if (userError && userError.code !== 'PGRST116') {
      console.error('Error fetching user data:', userError)
      // User doesn't exist in users table - create profile with default org
    }

    if (userData?.organization_id) {
      organizationId = userData.organization_id
    } else {
      // User has no organization - create a default one
      console.warn(`[Legal Accept] User ${user.id} has no organization_id - creating default org`)
      
      // Use service role client to create org (bypasses RLS)
      const { createSupabaseServiceClient } = await import('@/lib/supabase/client')
      const serviceSupabase = createSupabaseServiceClient()
      
      const orgName = userData?.full_name 
        ? `${userData.full_name}'s Organization`
        : userData?.email 
        ? `${userData.email.split('@')[0]}'s Organization`
        : 'My Organization'
      
      const { data: newOrg, error: orgError } = await serviceSupabase
        .from('organizations')
        .insert({
          name: orgName,
          trade_type: 'other',
          subscription_tier: 'starter',
          subscription_status: 'trialing',
        })
        .select('id')
        .single()

      if (orgError || !newOrg) {
        console.error('Failed to create default organization:', orgError)
        return NextResponse.json(
          { 
            message: 'Failed to set up organization. Please contact support.',
            code: 'ORG_CREATION_FAILED'
          },
          { status: 500 }
        )
      }

      organizationId = newOrg.id

      // Update user with organization_id
      const { error: updateError } = await serviceSupabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          organization_id: organizationId,
          role: 'owner',
          full_name: userData?.full_name || null,
        }, { onConflict: 'id' })

      if (updateError) {
        console.error('Failed to update user with organization_id:', updateError)
        // Continue anyway - org was created
      }
    }

    const ipAddress = getClientIp(request.headers) || undefined

    // Upsert legal acceptance
    const { data, error } = await supabase
      .from('legal_acceptances')
      .upsert(
        {
          user_id: user.id,
          organization_id: organizationId!,
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
        { message: 'Failed to record legal acceptance', details: error.message },
        { status: 500 }
      )
    }

    // Record audit log
    try {
      await supabase.from('audit_logs').insert({
        organization_id: organizationId!,
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

