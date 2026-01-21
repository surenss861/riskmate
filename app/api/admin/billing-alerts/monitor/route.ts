import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isAdminOrOwner, getUserRole } from '@/lib/utils/adminAuth'
import { checkMonitoringConditions, autoResolveAlerts } from '@/lib/billingMonitoring'
import { timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/admin/billing-alerts/monitor
 * 
 * Checks monitoring conditions and auto-resolves alerts.
 * Should be called by cron job (hourly recommended).
 * 
 * Authentication:
 * - Cron: Requires MONITOR_SECRET in Authorization header
 * - Manual: Requires admin/owner role (for dashboard triggers)
 * 
 * Checks:
 * - No reconcile run in 2 hours → alert
 * - High severity alerts unresolved for 30+ mins → alert
 * - Auto-resolve drift alerts if mismatch_count becomes 0
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const monitorSecret = process.env.MONITOR_SECRET || process.env.RECONCILE_SECRET // Fallback to reconcile secret if monitor secret not set

    // Require authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing Authorization header' },
        { status: 401 }
      )
    }

    const providedSecret = authHeader.split('Bearer ')[1]?.trim()

    // Check if it's a cron secret (constant-time comparison)
    if (monitorSecret) {
      const expectedSecret = Buffer.from(monitorSecret)
      const actualSecret = Buffer.from(providedSecret)

      if (actualSecret.length === expectedSecret.length && timingSafeEqual(actualSecret, expectedSecret)) {
        // Cron job with secret - proceed
      } else {
        // Not a cron secret - check if it's an admin user (for manual triggers)
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const userRole = await getUserRole(supabase, user.id)
          if (!isAdminOrOwner(userRole)) {
            return NextResponse.json(
              { error: 'Unauthorized - Requires MONITOR_SECRET or admin role' },
              { status: 401 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Unauthorized - Requires MONITOR_SECRET or admin role' },
            { status: 401 }
          )
        }
      }
    } else {
      // No monitor secret configured - fallback to admin auth only
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized - MONITOR_SECRET not configured, requires admin auth' },
          { status: 401 }
        )
      }
      const userRole = await getUserRole(supabase, user.id)
      if (!isAdminOrOwner(userRole)) {
        return NextResponse.json(
          { error: 'Unauthorized - Requires admin role' },
          { status: 401 }
        )
      }
    }

    // Check monitoring conditions
    const conditions = await checkMonitoringConditions()

    // Auto-resolve alerts
    const autoResolve = await autoResolveAlerts()

    return NextResponse.json({
      success: true,
      monitoring: {
        reconcile_stale: conditions.reconcileStale,
        high_severity_stale: conditions.highSeverityStale,
      },
      auto_resolve: {
        resolved_count: autoResolve.resolved_count,
      },
    })
  } catch (error: any) {
    console.error('[BillingMonitoring] Monitor error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to run monitoring checks' },
      { status: 500 }
    )
  }
}
