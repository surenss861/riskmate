import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

/**
 * POST /api/admin/billing-alerts/[id]/resolve
 * 
 * Marks a billing alert as resolved.
 * Requires authentication.
 */
// Rate limiting: simple in-memory store
const resolveRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10 // Max 10 resolves per minute per IP

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting: Per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    const now = Date.now()
    const rateLimitKey = `resolve-alert:${ip}`
    const rateLimit = resolveRateLimit.get(rateLimitKey)

    if (rateLimit && rateLimit.resetAt > now) {
      if (rateLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            retry_after: Math.ceil((rateLimit.resetAt - now) / 1000),
          },
          { status: 429 }
        )
      }
      rateLimit.count++
    } else {
      resolveRateLimit.set(rateLimitKey, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      })
    }

    // Clean up old rate limit entries
    for (const [key, value] of resolveRateLimit.entries()) {
      if (value.resetAt < now) {
        resolveRateLimit.delete(key)
      }
    }

    // Verify user is admin or owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to verify user role' },
        { status: 500 }
      )
    }

    // Only owners and admins can resolve billing alerts
    if (!['owner', 'admin'].includes(userData.role)) {
      console.warn('[BillingAlerts] Non-admin attempt to resolve alert', {
        user_id: user.id,
        role: userData.role,
        alert_id: (await params).id,
        ip,
      })
      return NextResponse.json(
        { error: 'Forbidden - Only owners and admins can resolve billing alerts' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Use service role to update (bypasses RLS)
    const serviceSupabase = getServiceSupabase()
    const { error: updateError } = await serviceSupabase
      .from('billing_alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', id)

    if (updateError) {
      console.error('[BillingAlerts] Failed to resolve alert:', updateError)
      return NextResponse.json(
        { error: 'Failed to resolve alert' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[BillingAlerts] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resolve alert' },
      { status: 500 }
    )
  }
}
