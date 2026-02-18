import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getBulkAuth, BULK_CAP, type BulkFailedItem } from '../shared'
import { hasPermission } from '@/lib/utils/permissions'
import { recordAuditLog } from '@/lib/audit/auditLogger'

export const runtime = 'nodejs'

const VALID_FORMATS = ['csv', 'pdf'] as const
type ExportFormat = (typeof VALID_FORMATS)[number]

/**
 * POST /api/jobs/bulk/export
 * Body: { job_ids: string[], formats: ('csv'|'pdf')[] }
 * Enqueues export work to the background worker, returns export ID and download polling info.
 * Audit log: export.bulk_jobs.requested. Partial success: export is enqueued for found jobs only; failed list in response.
 */
export async function POST(request: NextRequest) {
  const auth = await getBulkAuth(request)
  if ('errorResponse' in auth) return auth.errorResponse
  const { organization_id, user_id } = auth

  const supabase = await createSupabaseServerClient()
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user_id)
    .single()
  const role = (userData?.role as 'owner' | 'admin' | 'member') ?? 'member'
  if (!hasPermission(role, 'jobs.edit')) {
    return NextResponse.json(
      { message: 'You do not have permission to export jobs' },
      { status: 403 }
    )
  }

  let body: { job_ids?: unknown; formats?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { message: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const job_ids = body?.job_ids
  if (!Array.isArray(job_ids) || job_ids.length === 0) {
    return NextResponse.json(
      { message: 'job_ids (array) is required and must be non-empty' },
      { status: 400 }
    )
  }
  if (job_ids.length > BULK_CAP) {
    return NextResponse.json(
      { message: `Maximum ${BULK_CAP} jobs per bulk operation.` },
      { status: 400 }
    )
  }
  const jobIds = job_ids as string[]

  const rawFormats = Array.isArray(body?.formats) ? body.formats : ['csv']
  const formats = rawFormats.filter((f): f is ExportFormat =>
    typeof f === 'string' && VALID_FORMATS.includes(f as ExportFormat)
  )
  if (formats.length === 0) {
    return NextResponse.json(
      { message: 'At least one format required: csv or pdf' },
      { status: 400 }
    )
  }

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, client_name, job_type, location, status, risk_score, risk_level, owner_name, created_at, updated_at')
    .eq('organization_id', organization_id)
    .in('id', jobIds)

  if (jobsError) {
    return NextResponse.json(
      { message: 'Failed to fetch jobs', code: 'QUERY_ERROR' },
      { status: 500 }
    )
  }

  const foundIds = new Set((jobs ?? []).map((j: { id: string }) => j.id))
  const succeeded = jobIds.filter((id) => foundIds.has(id))
  const failed: BulkFailedItem[] = jobIds
    .filter((id) => !foundIds.has(id))
    .map((id) => ({ id, code: 'NOT_FOUND', message: 'Job not found' }))

  if (succeeded.length === 0) {
    return NextResponse.json(
      { message: 'No jobs found to export', data: { succeeded: [], failed } },
      { status: 200 }
    )
  }

  const { data: exportRow, error: insertError } = await supabase
    .from('exports')
    .insert({
      organization_id,
      work_record_id: null,
      export_type: 'bulk_jobs',
      state: 'queued',
      progress: 0,
      filters: { job_ids: succeeded, formats },
      created_by: user_id,
      requested_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json(
      { message: 'Failed to enqueue export', code: 'INSERT_ERROR' },
      { status: 500 }
    )
  }

  await recordAuditLog(supabase, {
    organizationId: organization_id,
    actorId: user_id,
    eventName: 'export.bulk_jobs.requested',
    targetType: 'export',
    targetId: exportRow.id,
    metadata: { job_count: succeeded.length, formats, failed_count: failed.length },
  })

  return NextResponse.json(
    {
      export_id: exportRow.id,
      status: 'queued',
      message: 'Export started. Poll GET /api/exports/:id for status and download URL.',
      data: { succeeded, failed },
    },
    { status: 202 }
  )
}
