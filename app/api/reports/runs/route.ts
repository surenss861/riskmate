import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildJobReport } from '@/lib/utils/jobReport'
import { buildJobPacket } from '@/lib/utils/packets/builder'
import { computeCanonicalHash } from '@/lib/utils/canonicalJson'
import { isValidPacketType } from '@/lib/utils/packets/types'

export const runtime = 'nodejs'

/**
 * POST /api/reports/runs
 * Creates a new report run (frozen version) for a job.
 * Payload is built server-side from job data; client must not supply report_payload.
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
    const { job_id, report_payload, packet_type = 'insurance' } = body
    // Ignore client-provided status; new runs are always draft to enforce signing workflow

    if (!job_id) {
      return NextResponse.json(
        { message: 'Missing required field: job_id' },
        { status: 400 }
      )
    }

    // Reject client-supplied payload; we build server snapshot for integrity
    if (report_payload !== undefined) {
      return NextResponse.json(
        { message: 'report_payload must not be supplied; server builds payload from job_id and packet_type' },
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

    // Build canonical payload server-side (same as verification)
    let serverPayload: any
    if (isValidPacketType(packetType)) {
      serverPayload = await buildJobPacket({
        jobId: job_id,
        packetType,
        organizationId: userData.organization_id,
        supabaseClient: supabase,
      })
    } else {
      serverPayload = await buildJobReport(
        userData.organization_id,
        job_id,
        supabase
      )
    }

    // Compute data hash using same canonical hashing as verification
    const dataHash = computeCanonicalHash(serverPayload)

    // Create report run (persist data_hash for tamper-evidence); status always draft
    const { data: reportRun, error: createError } = await supabase
      .from('report_runs')
      .insert({
        organization_id: userData.organization_id,
        job_id,
        status: 'draft',
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

