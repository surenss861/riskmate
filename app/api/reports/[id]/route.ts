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

    // Verify job belongs to organization
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (!job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Get report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('job_id', jobId)
      .maybeSingle()

    if (reportError) {
      throw reportError
    }

    if (!report) {
      return NextResponse.json(
        { message: 'Report not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: report })
  } catch (error: any) {
    console.error('Report fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch report' },
      { status: 500 }
    )
  }
}

