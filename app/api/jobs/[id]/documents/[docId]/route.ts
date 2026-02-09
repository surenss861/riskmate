import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { createErrorResponse } from '@/lib/utils/apiResponse'
import { recordAuditLog } from '@/lib/audit/auditLogger'

export const runtime = 'nodejs'

const VALID_CATEGORIES = ['before', 'during', 'after'] as const

const IMAGE_MIME_PREFIX = 'image/'

const READ_ONLY_ROLES = ['executive', 'auditor'] as const

/**
 * PATCH /api/jobs/[id]/documents/[docId]
 * Update photo category (before/during/after). Applies to:
 * - Documents: category stored in job_photos (by file_path).
 * - Evidence items (iOS): docId is evidence.id; updates evidence.phase and optionally job_photos for consistency with merged GET.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const context = await getOrganizationContext(request)
    const { id: jobId, docId } = await params

    if (READ_ONLY_ROLES.includes(context.user_role as (typeof READ_ONLY_ROLES)[number])) {
      const supabase = await createSupabaseServerClient()
      await recordAuditLog(supabase, {
        organizationId: context.organization_id,
        actorId: context.user_id,
        eventName: 'auth.role_violation',
        targetType: 'document',
        targetId: docId,
        metadata: {
          attempted_action: 'update_document',
          policy_statement: 'Executives and auditors have read-only access and cannot update documents',
          endpoint: `/api/jobs/${jobId}/documents/${docId}`,
          role: context.user_role,
        },
      })
      const { response } = createErrorResponse(
        'Read-only users cannot update document category',
        'AUTH_ROLE_READ_ONLY',
        { statusCode: 403 }
      )
      return NextResponse.json(response, { status: 403 })
    }

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

    if (doc) {
      // Real document: must be photo to update category
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
    }

    // docId not in documents: try evidence (iOS evidence items returned by merged GET)
    const { data: ev, error: evError } = await supabase
      .from('evidence')
      .select('id, storage_path, phase, mime_type')
      .eq('id', docId)
      .eq('work_record_id', jobId)
      .eq('organization_id', context.organization_id)
      .eq('state', 'sealed')
      .maybeSingle()

    if (evError) throw evError
    if (!ev) {
      return NextResponse.json(
        { message: 'Document not found' },
        { status: 404 }
      )
    }

    const isImage = ev.mime_type?.toLowerCase().startsWith(IMAGE_MIME_PREFIX)
    if (!isImage) {
      const { response } = createErrorResponse('Category can only be updated for photos', 'VALIDATION_ERROR', { statusCode: 400 })
      return NextResponse.json(response, { status: 400 })
    }

    const storagePath = ev.storage_path ?? ''

    // Update evidence.phase so merged GET returns the new category
    const { error: phaseError } = await supabase
      .from('evidence')
      .update({ phase: body.category })
      .eq('id', ev.id)

    if (phaseError) throw phaseError

    // Sync job_photos for this path so merged GET (categoryByPath / fromPhase) stays consistent
    const { data: existingPhoto } = await supabase
      .from('job_photos')
      .select('id')
      .eq('job_id', jobId)
      .eq('organization_id', context.organization_id)
      .eq('file_path', storagePath)
      .maybeSingle()

    if (existingPhoto) {
      await supabase
        .from('job_photos')
        .update({ category: body.category })
        .eq('id', existingPhoto.id)
    } else if (storagePath) {
      await supabase
        .from('job_photos')
        .insert({
          job_id: jobId,
          organization_id: context.organization_id,
          file_path: storagePath,
          category: body.category,
          created_by: context.user_id ?? null,
        })
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: ev.id,
        file_path: storagePath,
        type: 'photo' as const,
        category: body.category,
      },
    })
  } catch (error: unknown) {
    console.error('Document category update failed:', error)
    return NextResponse.json(
      { message: 'Failed to update photo category' },
      { status: 500 }
    )
  }
}
