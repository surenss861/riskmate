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
