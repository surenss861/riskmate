import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildJobPacket } from '@/lib/utils/packets/builder'
import { computeCanonicalHash } from '@/lib/utils/canonicalJson'
import { isValidPacketType, type PacketType } from '@/lib/utils/packets/types'

export const runtime = 'nodejs'

/**
 * GET /api/reports/runs/active?job_id=xxx&packet_type=insurance
 * Gets or creates an active (non-superseded, signable) run for a job
 * Idempotent: if an active run exists, returns it; otherwise creates a new one
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
    const packetType = (searchParams.get('packet_type') || 'insurance') as PacketType

    if (!jobId) {
      return NextResponse.json(
        { message: 'Missing job_id parameter' },
        { status: 400 }
      )
    }

    if (!isValidPacketType(packetType)) {
      return NextResponse.json(
        { message: 'Invalid packet_type' },
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

    // Look for an active (non-superseded, non-complete) run
    const { data: activeRun } = await supabase
      .from('report_runs')
      .select('*')
      .eq('job_id', jobId)
      .eq('organization_id', userData.organization_id)
      .eq('packet_type', packetType)
      .neq('status', 'superseded')
      .neq('status', 'complete')
      .neq('status', 'final')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (activeRun) {
      // Return existing active run
      return NextResponse.json({ 
        data: activeRun,
        created: false 
      })
    }

    // No active run exists - create a new one
    const packetData = await buildJobPacket({
      jobId,
      packetType,
      organizationId: userData.organization_id,
    })

    const dataHash = computeCanonicalHash(packetData)

    // Check for recent duplicate (within last 30 seconds) to prevent rapid duplicates
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
    const { data: recentRun } = await supabase
      .from('report_runs')
      .select('*')
      .eq('job_id', jobId)
      .eq('organization_id', userData.organization_id)
      .eq('packet_type', packetType)
      .eq('data_hash', dataHash)
      .gte('generated_at', thirtySecondsAgo)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentRun) {
      // Return the recent run to prevent duplicates
      return NextResponse.json({ 
        data: recentRun,
        created: false 
      })
    }

    // Create new run in signing-ready state so TeamSignatures can create then sign without manual status change
    const { data: newRun, error: createError } = await supabase
      .from('report_runs')
      .insert({
        organization_id: userData.organization_id,
        job_id: jobId,
        packet_type: packetType,
        status: 'ready_for_signatures',
        generated_by: user.id,
        data_hash: dataHash,
      })
      .select()
      .single()

    if (createError || !newRun) {
      console.error('[reports/runs/active] Failed to create run:', createError)
      return NextResponse.json(
        { message: 'Failed to create report run', detail: createError?.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      data: newRun,
      created: true 
    })
  } catch (error: any) {
    console.error('[reports/runs/active] Error:', error)
    return NextResponse.json(
      { message: 'Internal server error', detail: error?.message },
      { status: 500 }
    )
  }
}

