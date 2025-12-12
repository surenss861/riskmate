import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/[id]/assign
 * Assign a worker to a job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organization_id, user_id } = await getOrganizationContext()
    const { id: jobId } = await params
    const { worker_id } = await request.json()

    if (!worker_id) {
      return NextResponse.json(
        { error: 'worker_id is required' },
        { status: 400 }
      )
    }

    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()

    // Verify worker belongs to organization
    const { data: worker, error: workerError } = await supabase
      .from('users')
      .select('id, email, full_name, organization_id')
      .eq('id', worker_id)
      .eq('organization_id', organization_id)
      .single()

    if (workerError || !worker) {
      return NextResponse.json(
        { error: 'Worker not found or does not belong to your organization' },
        { status: 404 }
      )
    }

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from('job_assignments')
      .select('id')
      .eq('job_id', jobId)
      .eq('worker_id', worker_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Worker is already assigned to this job' },
        { status: 400 }
      )
    }

    // Create assignment (schema uses user_id, not worker_id)
    const { data: assignment, error: assignError } = await supabase
      .from('job_assignments')
      .insert({
        job_id: jobId,
        user_id: worker_id, // Schema uses user_id
        role: 'worker', // Default role
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (assignError) {
      console.error('Assignment creation failed:', assignError)
      return NextResponse.json(
        { error: 'Failed to assign worker to job' },
        { status: 500 }
      )
    }

    // Record audit log
    await supabase.from('audit_logs').insert({
      organization_id,
      actor_id: user_id,
      event_name: 'worker.assigned',
      target_type: 'job',
      target_id: jobId,
      metadata: {
        worker_id: worker_id,
        worker_name: worker.full_name || worker.email,
      },
    })

    return NextResponse.json({
      data: {
        ...assignment,
        worker: {
          id: worker.id,
          email: worker.email,
          full_name: worker.full_name,
        },
      },
    })
  } catch (error: any) {
    console.error('Job assignment failed:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to assign worker to job',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/jobs/[id]/assign
 * Unassign a worker from a job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organization_id, user_id } = await getOrganizationContext()
    const { id: jobId } = await params
    const { worker_id } = await request.json()

    if (!worker_id) {
      return NextResponse.json(
        { error: 'worker_id is required' },
        { status: 400 }
      )
    }

    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()

    // Get worker info for audit log
    const { data: worker } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', worker_id)
      .single()

    // Delete assignment (schema uses user_id, not worker_id)
    const { error: deleteError } = await supabase
      .from('job_assignments')
      .delete()
      .eq('job_id', jobId)
      .eq('user_id', worker_id) // Schema uses user_id

    if (deleteError) {
      console.error('Assignment deletion failed:', deleteError)
      return NextResponse.json(
        { error: 'Failed to unassign worker from job' },
        { status: 500 }
      )
    }

    // Record audit log
    await supabase.from('audit_logs').insert({
      organization_id,
      actor_id: user_id,
      event_name: 'worker.unassigned',
      target_type: 'job',
      target_id: jobId,
      metadata: {
        worker_id: worker_id,
        worker_name: worker?.full_name || worker?.email,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Worker unassigned successfully',
    })
  } catch (error: any) {
    console.error('Job unassignment failed:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to unassign worker from job',
      },
      { status: 500 }
    )
  }
}

