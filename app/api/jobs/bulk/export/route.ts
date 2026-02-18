import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, type BulkFailedItem } from '../shared'
import { getRequestId } from '@/lib/utils/requestId'
import { hasPermission } from '@/lib/utils/permissions'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/bulk/export
 * Validate access to job IDs for export; returns { data: { succeeded, failed } }.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

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

  const parsed = await parseBulkJobIds(request)
  if ('errorResponse' in parsed) return parsed.errorResponse
  const { jobIds } = parsed

  const succeeded: string[] = []
  const failed: BulkFailedItem[] = []

  for (const jobId of jobIds) {
    if (typeof jobId !== 'string') {
      failed.push({ id: String(jobId), code: 'INVALID_ID', message: 'Invalid job id' })
      continue
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (jobError || !job) {
      failed.push({ id: jobId, code: 'NOT_FOUND', message: 'Job not found' })
      continue
    }
    succeeded.push(jobId)
  }

  return NextResponse.json({
    data: { succeeded, failed },
  })
}
