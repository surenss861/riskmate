import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get organization context (throws if unauthorized)
    const { organization_id } = await getOrganizationContext()
    const { id: jobId } = await params

    // Verify job ownership (defense-in-depth)
    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()

    // Get job (RLS will also enforce organization_id)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('organization_id', organization_id) // Explicit filter
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get organization context (throws if unauthorized)
    const { organization_id } = await getOrganizationContext()
    const { id: jobId } = await params
    const body = await request.json()

    // Verify job ownership (defense-in-depth)
    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()

    // Extract fields that can be updated
    const {
      client_name,
      client_type,
      job_type,
      location,
      description,
      start_date,
      end_date,
      has_subcontractors,
      subcontractor_count,
      insurance_status,
      risk_factor_codes,
    } = body

    // Update job fields (excluding risk_factor_codes which needs special handling)
    const updateData: any = {}
    if (client_name !== undefined) updateData.client_name = client_name
    if (client_type !== undefined) updateData.client_type = client_type
    if (job_type !== undefined) updateData.job_type = job_type
    if (location !== undefined) updateData.location = location
    if (description !== undefined) updateData.description = description
    if (start_date !== undefined) updateData.start_date = start_date || null
    if (end_date !== undefined) updateData.end_date = end_date || null
    if (has_subcontractors !== undefined) updateData.has_subcontractors = has_subcontractors
    if (subcontractor_count !== undefined) updateData.subcontractor_count = subcontractor_count
    if (insurance_status !== undefined) updateData.insurance_status = insurance_status

    // Update job if there are fields to update
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId)

      if (updateError) {
        throw updateError
      }
    }

    // Handle risk factor recalculation if provided
    // Note: Full risk scoring implementation would require importing risk scoring utilities
    // For now, we'll update basic job fields. Risk scoring can be handled separately
    // or we can add the risk scoring logic here in a future update

    // Fetch updated job
    const { data: updatedJob, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError) {
      throw fetchError
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
        ...updatedJob,
        risk_score_detail: riskScore || null,
        mitigation_items: mitigationItems || [],
      },
    })
  } catch (error: any) {
    console.error('Job update failed:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to update job' },
      { status: 500 }
    )
  }
}
