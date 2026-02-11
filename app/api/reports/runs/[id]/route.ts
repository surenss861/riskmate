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

/**
 * PATCH /api/reports/runs/[id]
 * Updates a report run. Only allows promoting draft -> ready_for_signatures so UI-created drafts can be signed.
 */
export async function PATCH(
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

    const body = await request.json().catch(() => ({}))
    const { status: requestedStatus } = body

    // Only allow promoting draft -> ready_for_signatures
    if (requestedStatus !== 'ready_for_signatures') {
      return NextResponse.json(
        { message: 'Only status update to ready_for_signatures is allowed' },
        { status: 400 }
      )
    }

    const { data: reportRun, error: fetchError } = await supabase
      .from('report_runs')
      .select('id, organization_id, status')
      .eq('id', reportRunId)
      .eq('organization_id', userData.organization_id)
      .single()

    if (fetchError || !reportRun) {
      return NextResponse.json(
        { message: 'Report run not found' },
        { status: 404 }
      )
    }

    if (reportRun.status !== 'draft') {
      return NextResponse.json(
        { message: 'Run is not in draft; only draft runs can be moved to ready_for_signatures' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('report_runs')
      .update({ status: 'ready_for_signatures' })
      .eq('id', reportRunId)
      .eq('organization_id', userData.organization_id)
      .select()
      .single()

    if (updateError || !updated) {
      console.error('[reports/runs/[id]] PATCH failed:', updateError)
      return NextResponse.json(
        { message: 'Failed to update report run', detail: updateError?.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error('[reports/runs/[id]] PATCH Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

