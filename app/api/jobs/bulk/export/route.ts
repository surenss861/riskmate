import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getBulkAuth, BULK_CAP, type BulkFailedItem } from '../shared'
import { hasPermission } from '@/lib/utils/permissions'
import { buildCsvString, buildPdfBuffer, type JobRowForExport } from '@/lib/utils/exportJobsServer'
import archiver from 'archiver'

export const runtime = 'nodejs'

const VALID_FORMATS = ['csv', 'pdf'] as const
type ExportFormat = (typeof VALID_FORMATS)[number]

/**
 * POST /api/jobs/bulk/export
 * Body: { job_ids: string[], formats: ('csv'|'pdf')[] }
 * Validates access, fetches all requested jobs in one query, generates CSV/PDF
 * server-side, and returns a ZIP (or single file) for download.
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
      { data: { succeeded: [], failed } },
      { status: 400 }
    )
  }

  const jobRows: JobRowForExport[] = (jobs ?? []).map((j: any) => ({
    id: j.id,
    client_name: j.client_name ?? '',
    job_type: j.job_type ?? null,
    location: j.location ?? null,
    status: j.status ?? null,
    risk_score: j.risk_score ?? null,
    risk_level: j.risk_level ?? null,
    owner_name: j.owner_name ?? null,
    created_at: j.created_at ?? null,
    updated_at: j.updated_at ?? null,
  }))

  const dateStr = new Date().toISOString().slice(0, 10)
  const csvName = `work-records-export-${dateStr}.csv`
  const pdfName = `work-records-export-${dateStr}.pdf`

  if (formats.length === 1) {
    if (formats[0] === 'csv') {
      const csv = buildCsvString(jobRows)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${csvName}"`,
          'X-Export-Filename': csvName,
        },
      })
    }
    const pdfBuffer = await buildPdfBuffer(jobRows)
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdfName}"`,
        'X-Export-Filename': pdfName,
      },
    })
  }

  const archive = archiver('zip', { zlib: { level: 9 } })
  const chunks: Buffer[] = []
  archive.on('data', (chunk: Buffer) => chunks.push(chunk))

  const csv = buildCsvString(jobRows)
  archive.append(csv, { name: csvName })
  const pdfBuffer = await buildPdfBuffer(jobRows)
  archive.append(Buffer.from(pdfBuffer), { name: pdfName })
  await archive.finalize()

  const zipBuffer = Buffer.concat(chunks)
  const zipName = `work-records-export-${dateStr}.zip`
  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'X-Export-Filename': zipName,
    },
  })
}
