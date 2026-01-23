import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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
  const startTime = Date.now()
  let userId: string | null = null
  
  try {
    // Step 1: Verify auth token (use anon client for auth verification only)
    const authHeader = request.headers.get('authorization')
    const authClient = await createSupabaseServerClient()
    let user = null
    let authError = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: { user: tokenUser }, error: tokenError } = await authClient.auth.getUser(token)
      user = tokenUser
      authError = tokenError
    } else {
      // Fallback to cookie-based auth
      const { data: { user: cookieUser }, error: cookieError } = await authClient.auth.getUser()
      user = cookieUser
      authError = cookieError
    }

    if (authError || !user) {
      console.error('[LEGAL_ACCEPT] Auth failed', { 
        hasHeader: !!authHeader, 
        error: authError?.message,
        code: authError?.code 
      })
      return NextResponse.json(
        { 
          message: 'Your session has expired. Please refresh the page and try again.',
          code: 'AUTH_UNAUTHORIZED',
          error: authError?.message
        },
        { status: 401 }
      )
    }

    userId = user.id

    // Step 2: Use SERVICE ROLE client for all database operations (bypasses RLS)
    let serviceSupabase
    try {
      serviceSupabase = createSupabaseAdminClient()
    } catch (clientError: any) {
      console.error('[LEGAL_ACCEPT] Failed to create service role client', { 
        error: clientError?.message,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
      })
      return NextResponse.json(
        { 
          message: 'Server configuration error. Please contact support.',
          code: 'SERVICE_CLIENT_ERROR',
          error: clientError?.message || 'Failed to initialize database client'
        },
        { status: 500 }
      )
    }

    // Step 3: Get or create user profile and organization
    let organizationId: string | null = null

    // Try to get existing user profile
    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('organization_id, email, full_name')
      .eq('id', user.id)
      .maybeSingle()

    if (userError && userError.code !== 'PGRST116') {
      console.error('[LEGAL_ACCEPT] User lookup error', { 
        userId: user.id.substring(0, 8), 
        error: userError.message,
        code: userError.code 
      })
    }

    if (userData?.organization_id) {
      organizationId = userData.organization_id
      console.log('[LEGAL_ACCEPT] Found existing org', { 
        userId: user.id.substring(0, 8), 
        orgId: organizationId.substring(0, 8) 
      })
    } else {
      // User has no organization - create a default one
      console.warn('[LEGAL_ACCEPT] User has no org_id - creating default org', { 
        userId: user.id.substring(0, 8),
        hasUserData: !!userData 
      })
      
      const orgName = userData?.full_name 
        ? `${userData.full_name}'s Organization`
        : userData?.email 
        ? `${userData.email.split('@')[0]}'s Organization`
        : user.email
        ? `${user.email.split('@')[0]}'s Organization`
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
        console.error('[LEGAL_ACCEPT] Org creation failed', { 
          userId: user.id.substring(0, 8),
          error: orgError?.message,
          code: orgError?.code,
          details: orgError?.details,
          hint: orgError?.hint
        })
        return NextResponse.json(
          { 
            message: 'Failed to set up organization. Please contact support.',
            code: 'ORG_CREATION_FAILED',
            error: orgError?.message
          },
          { status: 500 }
        )
      }

      organizationId = newOrg.id
      console.log('[LEGAL_ACCEPT] Created default org', { 
        userId: user.id.substring(0, 8),
        orgId: organizationId.substring(0, 8),
        orgName 
      })

      // Create or update user profile with organization_id
      const { error: upsertError } = await serviceSupabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email || userData?.email || null,
          organization_id: organizationId,
          role: 'owner',
          full_name: userData?.full_name || null,
        }, { onConflict: 'id' })

      if (upsertError) {
        console.error('[LEGAL_ACCEPT] User upsert failed', { 
          userId: user.id.substring(0, 8),
          error: upsertError.message,
          code: upsertError.code
        })
        // Continue anyway - org was created successfully
      } else {
        console.log('[LEGAL_ACCEPT] User profile updated', { 
          userId: user.id.substring(0, 8),
          orgId: organizationId.substring(0, 8)
        })
      }
    }

    if (!organizationId) {
      console.error('[LEGAL_ACCEPT] organizationId is null after all attempts', { userId: user.id.substring(0, 8) })
      return NextResponse.json(
        { 
          message: 'Failed to determine organization. Please contact support.',
          code: 'ORG_ID_MISSING'
        },
        { status: 500 }
      )
    }

    // Step 4: Record legal acceptance (idempotent - can be called multiple times)
    const ipAddress = getClientIp(request.headers) || undefined

    const { data, error: acceptError } = await serviceSupabase
      .from('legal_acceptances')
      .upsert(
        {
          user_id: user.id,
          organization_id: organizationId,
          version: LEGAL_VERSION,
          ip_address: ipAddress ?? null,
        },
        { onConflict: 'user_id,version' }
      )
      .select('accepted_at')
      .single()

    if (acceptError) {
      console.error('[LEGAL_ACCEPT] Legal acceptance upsert failed', { 
        userId: user.id.substring(0, 8),
        orgId: organizationId.substring(0, 8),
        error: acceptError.message,
        code: acceptError.code,
        details: acceptError.details,
        hint: acceptError.hint
      })
      return NextResponse.json(
        { 
          message: 'Failed to record legal acceptance',
          code: 'LEGAL_ACCEPT_FAILED',
          error: acceptError.message
        },
        { status: 500 }
      )
    }

    // Step 5: Record audit log (non-blocking - don't fail if this errors)
    try {
      await serviceSupabase.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        event_name: 'legal.accepted',
        target_type: 'legal',
        metadata: {
          version: LEGAL_VERSION,
          ip_address: ipAddress ?? null,
        },
      })
    } catch (auditError: any) {
      // Don't fail the request if audit log fails
      console.warn('[LEGAL_ACCEPT] Audit log failed (non-fatal)', { 
        userId: user.id.substring(0, 8),
        error: auditError?.message 
      })
    }

    const duration = Date.now() - startTime
    console.log('[LEGAL_ACCEPT] Success', { 
      userId: user.id.substring(0, 8),
      orgId: organizationId.substring(0, 8),
      version: LEGAL_VERSION,
      duration: `${duration}ms`
    })

    return NextResponse.json({
      accepted: true,
      version: LEGAL_VERSION,
      accepted_at: data?.accepted_at ?? new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[LEGAL_ACCEPT] Unexpected error', { 
      userId: userId?.substring(0, 8) || 'unknown',
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    return NextResponse.json(
      { 
        message: 'Failed to record legal acceptance',
        code: 'LEGAL_ACCEPT_ERROR',
        error: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

