import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'
import { getDefaultPhotoCategory } from '@/lib/utils/photoCategory'

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

    // Get documents for this job
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, type, file_size, file_path, mime_type, description, created_at, uploaded_by')
      .eq('job_id', jobId)
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Get job_photos for category (before/during/after)
    const { data: jobPhotos } = await supabase
      .from('job_photos')
      .select('file_path, category')
      .eq('job_id', jobId)
      .eq('organization_id', organization_id)

    const categoryByPath = new Map(
      (jobPhotos || []).map((p) => [p.file_path, p.category as 'before' | 'during' | 'after'])
    )

    // Image evidence from evidence bucket (iOS uploads): same shape as documents for galleries/re-categorization
    const IMAGE_MIME_PREFIX = 'image/'
    const { data: imageEvidence } = await supabase
      .from('evidence')
      .select('id, storage_path, file_name, mime_type, phase, created_at, uploaded_by')
      .eq('work_record_id', jobId)
      .eq('organization_id', organization_id)
      .eq('state', 'sealed')

    const PHOTO_CATEGORIES = ['before', 'during', 'after'] as const
    const evidenceAsDocuments = await Promise.all(
      (imageEvidence || [])
        .filter((ev) => ev.mime_type?.toLowerCase().startsWith(IMAGE_MIME_PREFIX))
        .map(async (ev) => {
          const fromJobPhotos = categoryByPath.get(ev.storage_path ?? '')
          const fromPhase =
            ev.phase && PHOTO_CATEGORIES.includes(ev.phase as (typeof PHOTO_CATEGORIES)[number])
              ? (ev.phase as (typeof PHOTO_CATEGORIES)[number])
              : null
          const category = fromJobPhotos ?? fromPhase ?? null
          try {
            const { data: signed } = await supabase.storage
              .from('evidence')
              .createSignedUrl(ev.storage_path, 60 * 10)
            return {
              id: ev.id,
              name: ev.file_name ?? 'Evidence',
              type: 'photo' as const,
              size: null as number | null,
              storage_path: ev.storage_path,
              mime_type: ev.mime_type,
              description: null,
              created_at: ev.created_at,
              uploaded_by: ev.uploaded_by ?? null,
              ...(category ? { category } : {}),
              url: signed?.signedUrl ?? null,
            }
          } catch (err) {
            console.warn('Failed to generate evidence signed URL', err)
            return {
              id: ev.id,
              name: ev.file_name ?? 'Evidence',
              type: 'photo' as const,
              size: null as number | null,
              storage_path: ev.storage_path,
              mime_type: ev.mime_type,
              description: null,
              created_at: ev.created_at,
              uploaded_by: ev.uploaded_by ?? null,
              ...(category ? { category } : {}),
              url: null,
            }
          }
        })
    )

    // Generate signed URLs for documents
    const documentsWithUrls = await Promise.all(
      (data || []).map(async (doc) => {
        try {
          const { data: signed } = await supabase.storage
            .from('documents')
            .createSignedUrl(doc.file_path, 60 * 10)

          return {
            id: doc.id,
            name: doc.name,
            type: doc.type,
            size: doc.file_size,
            storage_path: doc.file_path,
            mime_type: doc.mime_type,
            description: doc.description,
            created_at: doc.created_at,
            uploaded_by: doc.uploaded_by,
            ...(doc.type === 'photo' ? { category: categoryByPath.get(doc.file_path) ?? null } : {}),
            url: signed?.signedUrl || null,
          }
        } catch (error) {
          console.warn('Failed to generate document signed URL', error)
          return {
            id: doc.id,
            name: doc.name,
            type: doc.type,
            size: doc.file_size,
            storage_path: doc.file_path,
            mime_type: doc.mime_type,
            description: doc.description,
            created_at: doc.created_at,
            uploaded_by: doc.uploaded_by,
            ...(doc.type === 'photo' ? { category: categoryByPath.get(doc.file_path) ?? null } : {}),
            url: null,
          }
        }
      })
    )

    // Merge documents + evidence bucket images, sort by created_at
    const merged = [...documentsWithUrls, ...evidenceAsDocuments].sort(
      (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
    )
    return NextResponse.json({ data: merged })
  } catch (error: any) {
    console.error('Docs fetch failed:', error)
    return NextResponse.json(
      { message: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/jobs/[id]/documents
 * Request body: { name, type?, file_path, file_size, mime_type, description?, category? }
 * - category: 'before' | 'during' | 'after' (photos only; defaults to 'during' if omitted)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get organization context (throws if unauthorized)
    const { organization_id, user_id } = await getOrganizationContext()
    const { id: jobId } = await params
    const body = await request.json()

    // Verify job ownership (defense-in-depth)
    await verifyJobOwnership(jobId, organization_id)

    const supabase = await createSupabaseServerClient()
    const userId = user_id

    const { name, type = 'photo', file_path, file_size, mime_type, description, category } = body

    const validCategories = ['before', 'during', 'after'] as const

    // Fetch job status (and optional dates) to derive default photo category when omitted or invalid
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('status, start_date, end_date')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    const defaultCategory = getDefaultPhotoCategory(job.status ?? '')
    const photoCategory =
      type === 'photo' && category && validCategories.includes(category)
        ? category
        : type === 'photo'
          ? defaultCategory
          : undefined

    if (!name || !file_path || file_size === undefined || !mime_type) {
      return NextResponse.json(
        {
          message: 'Missing required metadata: name, file_path, file_size, mime_type',
        },
        { status: 400 }
      )
    }

    if (
      type === 'photo' &&
      category !== undefined &&
      !validCategories.includes(category as (typeof validCategories)[number])
    ) {
      return NextResponse.json(
        { message: 'Invalid category. Must be one of: before, during, after' },
        { status: 400 }
      )
    }

    const parsedFileSize = Number(file_size)
    if (!Number.isFinite(parsedFileSize) || parsedFileSize <= 0) {
      return NextResponse.json(
        { message: 'file_size must be a positive number' },
        { status: 400 }
      )
    }

    // Insert document metadata
    const { data: inserted, error: insertError } = await supabase
      .from('documents')
      .insert({
        job_id: jobId,
        organization_id,
        name,
        type,
        file_path,
        file_size: Math.round(parsedFileSize),
        mime_type,
        uploaded_by: userId,
        description: description ?? null,
      })
      .select('id, name, type, file_size, file_path, mime_type, description, created_at, uploaded_by')
      .single()

    if (insertError) {
      throw insertError
    }

    // When type is photo, also save to job_photos for category (before/during/after)
    if (type === 'photo' && photoCategory) {
      const { error: photoError } = await supabase.from('job_photos').insert({
        job_id: jobId,
        organization_id,
        file_path: inserted.file_path,
        description: description ?? null,
        category: photoCategory,
        created_by: userId,
      })

      if (photoError) {
        console.error('job_photos insert failed:', photoError)
        // Delete the document to avoid orphaned metadata without category (rollback)
        await supabase.from('documents').delete().eq('id', inserted.id)
        return NextResponse.json(
          { message: 'Failed to save photo category' },
          { status: 500 }
        )
      }
    }

    // Generate signed URL
    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(inserted.file_path, 60 * 10)

    return NextResponse.json(
      {
        data: {
          id: inserted.id,
          name: inserted.name,
          type: inserted.type,
          size: inserted.file_size,
          storage_path: inserted.file_path,
          mime_type: inserted.mime_type,
          description: inserted.description,
          created_at: inserted.created_at,
          uploaded_by: inserted.uploaded_by,
          ...(type === 'photo' ? { category: photoCategory! } : {}),
          url: signed?.signedUrl || null,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Document metadata save failed:', error)
    return NextResponse.json(
      { message: 'Failed to save document metadata' },
      { status: 500 }
    )
  }
}

