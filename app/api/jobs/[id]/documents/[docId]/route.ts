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
 * Update photo category (before/during/after). Mirrors backend: validate category, ensure job ownership,
 * update or insert job_photos by job_id/organization_id/file_path; return updated document/evidence shape.
 * - Documents: category stored in job_photos (by file_path).
 * - Evidence items (iOS): docId is evidence.id; update/insert job_photos only (same as backend).
 * Aligned with jobsApi.updateDocumentCategory() and spec.
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

    const categoryValue = body.category as (typeof VALID_CATEGORIES)[number]

    // Resolve document (photo) to get file_path; category is stored in job_photos
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('id, file_path, type, name, description, created_at')
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

      // Update or insert job_photos row (by job_id, organization_id, file_path) — mirror backend
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
          .update({ category: categoryValue })
          .eq('id', existing.id)
          .select()
          .single()

        if (updateError) throw updateError
        return NextResponse.json({
          ok: true,
          data: {
            id: doc.id,
            file_path: doc.file_path,
            type: doc.type,
            name: doc.name,
            description: doc.description ?? null,
            created_at: doc.created_at,
            category: updated?.category ?? categoryValue,
          },
        })
      }

      // No job_photos row: insert one (e.g. legacy photo) — mirror backend
      const { data: inserted, error: insertError } = await supabase
        .from('job_photos')
        .insert({
          job_id: jobId,
          organization_id: context.organization_id,
          file_path: doc.file_path,
          category: categoryValue,
          created_by: context.user_id ?? null,
        })
        .select()
        .single()

      if (insertError) throw insertError
      return NextResponse.json({
        ok: true,
        data: {
          id: doc.id,
          file_path: doc.file_path,
          type: doc.type,
          name: doc.name,
          description: doc.description ?? null,
          created_at: doc.created_at,
          category: inserted?.category ?? categoryValue,
        },
      })
    }

    // Path 2: no documents row — try evidence table (iOS/evidence photos); update job_photos only (mirror backend)
    const { data: ev, error: evError } = await supabase
      .from('evidence')
      .select('id, storage_path, file_name, mime_type, evidence_type, created_at')
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

    const { data: existingPhoto } = await supabase
      .from('job_photos')
      .select('id')
      .eq('job_id', jobId)
      .eq('organization_id', context.organization_id)
      .eq('file_path', storagePath)
      .maybeSingle()

    if (existingPhoto) {
      const { data: updated, error: updateError } = await supabase
        .from('job_photos')
        .update({ category: categoryValue })
        .eq('id', existingPhoto.id)
        .select()
        .single()

      if (updateError) throw updateError
      return NextResponse.json({
        ok: true,
        data: {
          id: ev.id,
          file_path: storagePath,
          type: 'photo' as const,
          name: ev.file_name ?? 'Evidence',
          description: ev.evidence_type ?? null,
          created_at: ev.created_at,
          category: updated?.category ?? categoryValue,
        },
      })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('job_photos')
      .insert({
        job_id: jobId,
        organization_id: context.organization_id,
        file_path: storagePath,
        category: categoryValue,
        created_by: context.user_id ?? null,
      })
      .select()
      .single()

    if (insertError) throw insertError
    return NextResponse.json({
      ok: true,
      data: {
        id: ev.id,
        file_path: storagePath,
        type: 'photo' as const,
        name: ev.file_name ?? 'Evidence',
        description: ev.evidence_type ?? null,
        created_at: ev.created_at,
        category: inserted?.category ?? categoryValue,
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
