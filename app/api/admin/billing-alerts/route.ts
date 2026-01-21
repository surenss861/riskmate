import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getUnresolvedAlerts } from '@/lib/billingMonitoring'

export const runtime = 'nodejs'

/**
 * GET /api/admin/billing-alerts
 * 
 * Returns unresolved billing alerts for dashboard display.
 * Requires authentication.
 */
// Rate limiting: simple in-memory store (use Redis in production)
const alertsRateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30 // Max 30 requests per minute per IP

export async function GET(request: NextRequest) {
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
    const rateLimitKey = `billing-alerts:${ip}`
    const rateLimit = alertsRateLimit.get(rateLimitKey)

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
      alertsRateLimit.set(rateLimitKey, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      })
    }

    // Clean up old rate limit entries
    for (const [key, value] of alertsRateLimit.entries()) {
      if (value.resetAt < now) {
        alertsRateLimit.delete(key)
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

    // Only owners and admins can view billing alerts
    if (!['owner', 'admin'].includes(userData.role)) {
      console.warn('[BillingAlerts] Non-admin attempt to access alerts', {
        user_id: user.id,
        role: userData.role,
        ip,
      })
      return NextResponse.json(
        { error: 'Forbidden - Only owners and admins can view billing alerts' },
        { status: 403 }
      )
    }

    // Get unresolved alerts
    const alerts = await getUnresolvedAlerts(undefined, 50)

    return NextResponse.json({
      alerts,
      count: alerts.length,
      critical_count: alerts.filter(a => a.severity === 'critical').length,
      warning_count: alerts.filter(a => a.severity === 'warning').length,
    })
  } catch (error: any) {
    console.error('[BillingAlerts] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get billing alerts' },
      { status: 500 }
    )
  }
}
