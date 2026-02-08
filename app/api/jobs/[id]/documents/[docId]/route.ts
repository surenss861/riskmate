import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'

export const runtime = 'nodejs'

const VALID_CATEGORIES = ['before', 'during', 'after'] as const

/**
 * PATCH /api/jobs/[id]/documents/[docId]
 * Update photo category (before/during/after). Only applies to photos; category is stored in job_photos.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const context = await getOrganizationContext(request)
    const { id: jobId, docId } = await params

    await verifyJobOwnership(jobId, context.organization_id)

    const body = await request.json()

    if (
      body.category !== undefined &&
      !VALID_CATEGORIES.includes(body.category as (typeof VALID_CATEGORIES)[number])
    ) {
      const { response } = createErrorResponse('Invalid category. Must be one of: before, during, after', 'VALIDATION_ERROR', { statusCode: 400 })
      return NextResponse.json(response, { status: 400 })
    }

    if (body.category === undefined) {
      const { response } = createErrorResponse('Missing category in body', 'VALIDATION_ERROR', { statusCode: 400 })
      return NextResponse.json(response, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    // Resolve document (photo) to get file_path; category is stored in job_photos
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, file_path, type')
      .eq('id', docId)
      .eq('job_id', jobId)
      .eq('organization_id', context.organization_id)
      .maybeSingle()

    if (docError) throw docError
    if (!doc) {
      return NextResponse.json(
        { message: 'Document not found' },
        { status: 404 }
      )
    }
    if (doc.type !== 'photo') {
      const { response } = createErrorResponse('Category can only be updated for photos', 'VALIDATION_ERROR', { statusCode: 400 })
      return NextResponse.json(response, { status: 400 })
    }

    // Update or insert job_photos row (insert for legacy photos that only exist in documents)
    const { data: existing } = await supabase
      .from('job_photos')
      .select('id')
      .eq('job_id', jobId)
      .eq('organization_id', context.organization_id)
      .eq('file_path', doc.file_path)
      .maybeSingle()

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('job_photos')
        .update({ category: body.category })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) throw updateError
      return NextResponse.json({ ok: true, data: { ...doc, category: updated.category } })
    }

    // Legacy photo: no job_photos row; create one with the new category
    const { data: inserted, error: insertError } = await supabase
      .from('job_photos')
      .insert({
        job_id: jobId,
        organization_id: context.organization_id,
        file_path: doc.file_path,
        category: body.category,
        created_by: context.user_id ?? null,
      })
      .select()
      .single()

    if (insertError) throw insertError
    return NextResponse.json({ ok: true, data: { ...doc, category: inserted.category } })
  } catch (error: unknown) {
    console.error('Document category update failed:', error)
    return NextResponse.json(
      { message: 'Failed to update photo category' },
      { status: 500 }
    )
  }
}
