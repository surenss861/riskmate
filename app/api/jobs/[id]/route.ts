import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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

    // Get user's organization_id
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

    const organization_id = userData.organization_id
    const { id: jobId } = await params

    // Get job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Get risk score
    const { data: riskScore } = await supabase
      .from('job_risk_scores')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle()

    // Get mitigation items
    const { data: mitigationItems } = await supabase
      .from('mitigation_items')
      .select('id, title, description, done, is_completed, completed_at, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      data: {
        ...job,
        risk_score_detail: riskScore || null,
        mitigation_items: mitigationItems || [],
      },
    })
  } catch (error: any) {
    console.error('Job fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch job' },
      { status: 500 }
    )
  }
}

