import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/jobs/[id]/signoffs
 * Get sign-offs for a specific job
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

    const { id: jobId } = await params

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

    const organizationId = userData.organization_id

    // Verify job belongs to organization
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, organization_id')
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Get signoffs for this job
    // Note: Adjust table name if your schema uses a different name (e.g., job_signoffs)
    const { data: signoffs, error: signoffsError } = await supabase
      .from('job_signoffs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (signoffsError) {
      // If table doesn't exist yet, return empty array (graceful degradation)
      if (signoffsError.code === '42P01' || signoffsError.message?.includes('does not exist')) {
        return NextResponse.json({ data: [] })
      }
      throw signoffsError
    }

    return NextResponse.json({ data: signoffs || [] })
  } catch (error: any) {
    console.error('Failed to get signoffs:', error)
    return NextResponse.json(
      {
        message: error?.message || 'Failed to get sign-offs',
        error: error?.message,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/jobs/[id]/signoffs
 * Create a new sign-off for a job
 */
export async function POST(
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

    const { id: jobId } = await params
    const body = await request.json()
    const { signoff_type, comments, role } = body

    // Get user's organization_id and role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.organization_id) {
      return NextResponse.json(
        { message: 'Failed to get organization ID' },
        { status: 500 }
      )
    }

    const organizationId = userData.organization_id
    const userRole = userData.role || 'member'

    // Verify job belongs to organization
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, organization_id')
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Create signoff
    // Note: Adjust table name and columns to match your schema
    const { data: signoff, error: signoffError } = await supabase
      .from('job_signoffs')
      .insert({
        job_id: jobId,
        organization_id: organizationId,
        signer_id: user.id,
        signoff_type: signoff_type || 'general',
        comments: comments || null,
        role: role || userRole,
      })
      .select()
      .single()

    if (signoffError) {
      // If table doesn't exist yet, return a graceful error
      if (signoffError.code === '42P01' || signoffError.message?.includes('does not exist')) {
        return NextResponse.json(
          { message: 'Sign-offs feature not yet available' },
          { status: 501 }
        )
      }
      throw signoffError
    }

    return NextResponse.json({ data: signoff })
  } catch (error: any) {
    console.error('Failed to create signoff:', error)
    return NextResponse.json(
      {
        message: error?.message || 'Failed to create sign-off',
        error: error?.message,
      },
      { status: 500 }
    )
  }
}

