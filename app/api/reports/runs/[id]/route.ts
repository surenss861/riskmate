import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/reports/runs/[id]
 * Gets a single report run by ID
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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    // Get report run and verify access
    const { data: reportRun, error } = await supabase
      .from('report_runs')
      .select('*')
      .eq('id', reportRunId)
      .eq('organization_id', userData.organization_id)
      .single()

    if (error || !reportRun) {
      return NextResponse.json(
        { message: 'Report run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: reportRun })
  } catch (error: any) {
    console.error('[reports/runs/[id]] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

