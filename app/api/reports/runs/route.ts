import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/reports/runs
 * Creates a new report run (frozen version) for a job
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    const body = await request.json()
    const { job_id, report_payload, status = 'draft', packet_type = 'insurance' } = body

    if (!job_id || !report_payload) {
      return NextResponse.json(
        { message: 'Missing required fields: job_id, report_payload' },
        { status: 400 }
      )
    }

    const validPacketTypes = ['insurance', 'audit', 'incident', 'client_compliance']
    const packetType = validPacketTypes.includes(packet_type) ? packet_type : 'insurance'

    // Verify job belongs to organization
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', job_id)
      .eq('organization_id', userData.organization_id)
      .single()

    if (!job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Compute data hash for audit integrity
    const dataHash = createHash('sha256')
      .update(JSON.stringify(report_payload))
      .digest('hex')

    // Create report run (persist data_hash for tamper-evidence)
    const { data: reportRun, error: createError } = await supabase
      .from('report_runs')
      .insert({
        organization_id: userData.organization_id,
        job_id,
        status,
        packet_type: packetType,
        generated_by: user.id,
        data_hash: dataHash,
      })
      .select()
      .single()

    if (createError) {
      console.error('[reports/runs] Failed to create report run:', createError)
      return NextResponse.json(
        { message: 'Failed to create report run', detail: createError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: reportRun })
  } catch (error: any) {
    console.error('[reports/runs] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/reports/runs?job_id=xxx
 * Gets report runs for a job
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('job_id')

    if (!jobId) {
      return NextResponse.json(
        { message: 'Missing job_id parameter' },
        { status: 400 }
      )
    }

    // Verify job belongs to organization
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('organization_id', userData.organization_id)
      .single()

    if (!job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Get report runs with limit and optional status filter
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const statusFilter = searchParams.get('status') ?? null
    let query = supabase
      .from('report_runs')
      .select('*')
      .eq('job_id', jobId)
      .eq('organization_id', userData.organization_id)
      .order('generated_at', { ascending: false })

    if (statusFilter && ['draft', 'ready_for_signatures', 'final', 'complete', 'superseded'].includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }

    if (limit > 0) {
      query = query.limit(limit)
    }

    const { data: reportRuns, error } = await query

    if (error) {
      console.error('[reports/runs] Failed to fetch report runs:', error)
      return NextResponse.json(
        { message: 'Failed to fetch report runs', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: reportRuns || [] })
  } catch (error: any) {
    console.error('[reports/runs] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

