import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isAdminOrOwner, getUserRole } from '@/lib/utils/adminAuth'

export const runtime = 'nodejs'

/**
 * POST /api/admin/billing-alerts/reconcile
 * 
 * One-click "Reconcile Now" button (admin only).
 * Server-side handles RECONCILE_SECRET - never exposed to client.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user is admin or owner
    const userRole = await getUserRole(supabase, user.id)
    
    if (!isAdminOrOwner(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden - Only owners and admins can trigger reconciliation' },
        { status: 403 }
      )
    }

    // Get reconcile secret from server (never exposed to client)
    const reconcileSecret = process.env.RECONCILE_SECRET
    if (!reconcileSecret) {
      return NextResponse.json(
        { error: 'Reconciliation not configured' },
        { status: 503 }
      )
    }

    // Trigger reconcile via internal call (server-to-server)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://riskmate.dev'
    const reconcileUrl = `${baseUrl}/api/subscriptions/reconcile?type=manual`

    const response = await fetch(reconcileUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${reconcileSecret}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      return NextResponse.json(
        { error: error.error || 'Failed to trigger reconciliation' },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      reconciliation_log_id: result.reconciliation_log_id,
      created_count: result.created_count,
      updated_count: result.updated_count,
      mismatch_count: result.mismatch_count,
      message: result.message,
    })
  } catch (error: any) {
    console.error('[BillingAlerts] Reconcile trigger error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to trigger reconciliation' },
      { status: 500 }
    )
  }
}
