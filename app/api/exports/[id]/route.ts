import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrganizationContext } from '@/lib/utils/organizationGuard'

export const runtime = 'nodejs'

/**
 * GET /api/exports/:id
 * Poll export status. Returns state, download_url when ready, and data (succeeded/failed from filters for bulk_jobs).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: exportId } = await params
  if (!exportId) {
    return NextResponse.json({ message: 'Export ID required' }, { status: 400 })
  }

  let organization_id: string
  try {
    const ctx = await getOrganizationContext(request)
    organization_id = ctx.organization_id
  } catch {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: exportRow, error } = await supabase
    .from('exports')
    .select('id, export_type, state, progress, storage_path, filters, error_message, failure_reason, created_at, completed_at')
    .eq('id', exportId)
    .eq('organization_id', organization_id)
    .single()

  if (error || !exportRow) {
    return NextResponse.json({ message: 'Export not found' }, { status: 404 })
  }

  let download_url: string | null = null
  if (exportRow.state === 'ready' && exportRow.storage_path) {
    const { data: signed } = await supabase.storage
      .from('exports')
      .createSignedUrl(exportRow.storage_path, 60 * 60 * 24 * 7)
    download_url = signed?.signedUrl ?? null
  }

  const filters = (exportRow.filters as { job_ids?: string[]; formats?: string[] }) ?? {}
  const filename = exportRow.storage_path
    ? exportRow.storage_path.split('/').pop() ?? null
    : null
  return NextResponse.json({
    data: {
      id: exportRow.id,
      export_type: exportRow.export_type,
      state: exportRow.state,
      progress: exportRow.progress ?? 0,
      download_url,
      filename,
      error_message: exportRow.error_message ?? null,
      failure_reason: exportRow.failure_reason ?? null,
      created_at: exportRow.created_at,
      completed_at: exportRow.completed_at ?? null,
      succeeded: filters.job_ids ?? [],
      failed: [],
    },
  })
}
