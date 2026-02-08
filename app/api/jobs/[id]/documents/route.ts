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
            category: doc.type === 'photo' ? (categoryByPath.get(doc.file_path) ?? null) : undefined,
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
            category: doc.type === 'photo' ? (categoryByPath.get(doc.file_path) ?? null) : undefined,
            url: null,
          }
        }
      })
    )

    return NextResponse.json({ data: documentsWithUrls })
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
    // Default to 'during' for photos when category not provided (ticket: Backend API & PDF for Photo Categories)
    const photoCategory =
      type === 'photo' && category && validCategories.includes(category)
        ? category
        : type === 'photo'
          ? 'during'
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
      await supabase.from('job_photos').insert({
        job_id: jobId,
        organization_id,
        file_path: inserted.file_path,
        description: description ?? null,
        category: photoCategory,
        created_by: userId,
      })
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

