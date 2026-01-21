import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isAdminOrOwner, getUserRole } from '@/lib/utils/adminAuth'
import { checkMonitoringConditions, autoResolveAlerts } from '@/lib/billingMonitoring'

export const runtime = 'nodejs'

/**
 * POST /api/admin/billing-alerts/monitor
 * 
 * Checks monitoring conditions and auto-resolves alerts.
 * Should be called by cron job (hourly recommended).
 * 
 * Checks:
 * - No reconcile run in 2 hours → alert
 * - High severity alerts unresolved for 30+ mins → alert
 * - Auto-resolve drift alerts if mismatch_count becomes 0
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Require admin auth for manual triggers
    // For cron, this will use RECONCILE_SECRET or similar
    const authHeader = request.headers.get('authorization')
    const reconcileSecret = process.env.RECONCILE_SECRET

    // Allow either admin auth or reconcile secret
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const providedSecret = authHeader.split('Bearer ')[1]?.trim()
      if (providedSecret === reconcileSecret) {
        // Cron job with secret - proceed
      } else {
        // Check if it's an admin user
        const supabase = await createSupabaseServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const userRole = await getUserRole(supabase, user.id)
          if (!isAdminOrOwner(userRole)) {
            return NextResponse.json(
              { error: 'Unauthorized' },
              { status: 401 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }
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
