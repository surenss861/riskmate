import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/reports/runs/[id]/signatures/check
 * Checks if all required signatures are present for a report run
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: reportRunId } = await params

    // Get report run and verify access
    const { data: reportRun } = await supabase
      .from('report_runs')
      .select('organization_id')
      .eq('id', reportRunId)
      .single()

    if (!reportRun) {
      return NextResponse.json(
        { message: 'Report run not found' },
        { status: 404 }
      )
    }

    // Verify user belongs to organization
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!userData || userData.organization_id !== reportRun.organization_id) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      )
    }

    // Required signature roles
    const REQUIRED_ROLES = ['prepared_by', 'reviewed_by', 'approved_by']

    // Get all non-revoked signatures
    const { data: signatures } = await supabase
      .from('report_signatures')
      .select('signature_role')
      .eq('report_run_id', reportRunId)
      .is('revoked_at', null)

    const signedRoles = new Set(signatures?.map((s) => s.signature_role) || [])
    const missingRoles = REQUIRED_ROLES.filter((role) => !signedRoles.has(role))
    const isComplete = missingRoles.length === 0

    return NextResponse.json({
      data: {
        isComplete,
        missingRoles,
        signedRoles: Array.from(signedRoles),
        requiredRoles: REQUIRED_ROLES,
      },
    })
  } catch (error: any) {
    console.error('[reports/runs/signatures/check] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

