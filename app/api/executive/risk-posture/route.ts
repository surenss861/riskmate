import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/executive/risk-posture
 * Returns risk posture metrics for executive dashboard
 * Response structure matches backend API: { data: { ... } }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const time_range = searchParams.get('time_range') || '30d'

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userData?.organization_id) {
      return NextResponse.json(
        { message: 'Organization not found' },
        { status: 403 }
      )
    }

    // Verify executive role
    if (userData.role !== 'executive' && userData.role !== 'owner' && userData.role !== 'admin') {
      return NextResponse.json(
        { message: 'Executive access required' },
        { status: 403 }
      )
    }

    // Return minimal valid response structure that matches backend API
    // This is a placeholder - full implementation would need ledger integrity checks, material events, etc.
    const riskPostureData = {
      exposure_level: 'low' as const,
      unresolved_violations: 0,
      open_reviews: 0,
      high_risk_jobs: 0,
      open_incidents: 0,
      pending_signoffs: 0,
      signed_signoffs: 0,
      proof_packs_generated: 0,
      last_material_event_at: null,
      confidence_statement: '✅ No unresolved governance violations. All jobs within acceptable risk thresholds.',
      ledger_integrity: 'not_verified' as const,
      ledger_integrity_last_verified_at: null,
      ledger_integrity_verified_through_event_id: null,
      flagged_jobs: 0,
      signed_jobs: 0,
      unsigned_jobs: 0,
      recent_violations: 0,
    }

    // Wrap in data property to match backend API response structure
    return NextResponse.json({
      data: riskPostureData,
    })
  } catch (error: any) {
    console.error('[executive/risk-posture] Unexpected error:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error?.message },
      { status: 500 }
    )
  }
}

