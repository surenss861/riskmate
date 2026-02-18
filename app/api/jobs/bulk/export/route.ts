import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getBulkAuth, BULK_CAP, buildBulkResults, type BulkFailedItem } from '../shared'
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

  const validIds = job_ids.filter((id): id is string => typeof id === 'string')
  const failedInvalid: BulkFailedItem[] = job_ids
    .filter((id) => typeof id !== 'string')
    .map((id) => ({
      id: String(id),
      code: 'INVALID_ID',
      message: 'Job ID must be a string',
    }))

  if (validIds.length === 0) {
    const total = failedInvalid.length
    return NextResponse.json(
      {
        success: false,
        message: 'No valid job IDs (each must be a string)',
        summary: { total, succeeded: 0, failed: total },
        data: { succeeded: [], failed: failedInvalid },
        results: buildBulkResults([], failedInvalid),
      },
      { status: 400 }
    )
  }

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
    .is('deleted_at', null)
    .is('archived_at', null)
    .in('id', validIds)

  if (jobsError) {
    return NextResponse.json(
      { message: 'Failed to fetch jobs', code: 'QUERY_ERROR' },
      { status: 500 }
    )
  }

  const foundIds = new Set((jobs ?? []).map((j: { id: string }) => j.id))
  const succeeded = validIds.filter((id) => foundIds.has(id))
  const failedNotFound: BulkFailedItem[] = validIds
    .filter((id) => !foundIds.has(id))
    .map((id) => ({ id, code: 'NOT_FOUND', message: 'Job not found or excluded (deleted/archived)' }))
  const failed: BulkFailedItem[] = [...failedInvalid, ...failedNotFound]

  if (succeeded.length === 0) {
    const total = failed.length
    return NextResponse.json(
      {
        success: false,
        message: 'No jobs found to export',
        summary: { total, succeeded: 0, failed: total },
        data: { succeeded: [], failed },
        results: buildBulkResults([], failed),
      },
      { status: 400 }
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
      filters: { job_ids: succeeded, formats, failed_job_ids: failed.map((f) => ({ id: f.id, code: f.code, message: f.message })) },
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

  const total = succeeded.length + failed.length
  const pollUrl = `/api/exports/${exportRow.id}`
  return NextResponse.json(
    {
      success: true,
      export_id: exportRow.id,
      status: 'queued',
      poll_url: pollUrl,
      message: 'Export started. Poll the poll_url for status; when state is "ready", the response includes download_url.',
      summary: { total, succeeded: succeeded.length, failed: failed.length },
      data: { succeeded, failed },
      results: buildBulkResults(succeeded, failed),
    },
    { status: 202 }
  )
}
