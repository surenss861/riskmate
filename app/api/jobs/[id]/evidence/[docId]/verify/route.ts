import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/[id]/evidence/[docId]/verify
 * Approve or reject evidence (photo/document) for a job
 * Business tier feature - managers/admins only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { organization_id, user_id } = await getOrganizationContext()
    const { id: jobId, docId } = await params
    const { status, reason } = await request.json()

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "approved" or "rejected"' },
        { status: 400 }
      )
    }

    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()

    // Verify user is admin or owner
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', user_id)
      .single()

    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return NextResponse.json(
        { error: 'Only admins and owners can verify evidence' },
        { status: 403 }
      )
    }

    // Verify document belongs to job
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, job_id, file_name')
      .eq('id', docId)
      .eq('job_id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found or does not belong to this job' },
        { status: 404 }
      )
    }

    // Check if verification already exists
    const { data: existing } = await supabase
      .from('evidence_verifications')
      .select('id')
      .eq('document_id', docId)
      .maybeSingle()

    if (existing) {
      // Update existing verification
      const { error: updateError } = await supabase
        .from('evidence_verifications')
        .update({
          status,
          reviewed_by: user_id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: status === 'rejected' ? reason || null : null,
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Verification update failed:', updateError)
        return NextResponse.json(
          { error: 'Failed to update evidence verification' },
          { status: 500 }
        )
      }
    } else {
      // Create new verification
      const { error: insertError } = await supabase
        .from('evidence_verifications')
        .insert({
          document_id: docId,
          job_id: jobId,
          organization_id,
          status,
          reviewed_by: user_id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: status === 'rejected' ? reason || null : null,
        })

      if (insertError) {
        console.error('Verification creation failed:', insertError)
        return NextResponse.json(
          { error: 'Failed to create evidence verification' },
          { status: 500 }
        )
      }
    }

    // Record audit log
    await supabase.from('audit_logs').insert({
      organization_id,
      actor_id: user_id,
      event_name: status === 'approved' ? 'evidence.approved' : 'evidence.rejected',
      target_type: 'document',
      target_id: docId,
      metadata: {
        job_id: jobId,
        document_name: document.file_name,
        rejection_reason: status === 'rejected' ? reason : null,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        document_id: docId,
        status,
        reviewed_by: user_id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: status === 'rejected' ? reason : null,
      },
    })
  } catch (error: any) {
    console.error('Evidence verification failed:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to verify evidence',
      },
      { status: 500 }
    )
  }
}

