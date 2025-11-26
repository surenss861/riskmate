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
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, organization_id')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
      )
    }

    // Get documents for this job
    const { data, error } = await supabase
      .from('documents')
      .select('id, name, type, file_size, file_path, mime_type, description, created_at, uploaded_by')
      .eq('job_id', jobId)
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: true })

    if (error) throw error

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
    const userId = user.id
    const { id: jobId } = await params
    const body = await request.json()

    const { name, type = 'photo', file_path, file_size, mime_type, description } = body

    if (!name || !file_path || file_size === undefined || !mime_type) {
      return NextResponse.json(
        {
          message: 'Missing required metadata: name, file_path, file_size, mime_type',
        },
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

    // Verify job belongs to organization
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { message: 'Job not found' },
        { status: 404 }
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

