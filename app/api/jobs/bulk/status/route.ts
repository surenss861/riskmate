import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, type BulkFailedItem } from '../shared'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  const auth = await getBulkAuth(request)
  if ('errorResponse' in auth) return auth.errorResponse
  const { organization_id, user_id } = auth

  const parsed = await parseBulkJobIds(request, true)
  if ('errorResponse' in parsed) return parsed.errorResponse
  const { jobIds, status } = parsed

  const succeeded: string[] = []
  const failed: BulkFailedItem[] = []

  const supabase = await createSupabaseServerClient()

  for (const jobId of jobIds) {
    if (typeof jobId !== 'string') {
      failed.push({ id: String(jobId), code: 'INVALID_ID', message: 'Invalid job id' })
      continue
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, status, archived_at, deleted_at')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (jobError || !job) {
      failed.push({ id: jobId, code: 'NOT_FOUND', message: 'Job not found' })
      continue
    }
    if (job.deleted_at) {
      failed.push({ id: jobId, code: 'ALREADY_DELETED', message: 'Job has been deleted' })
      continue
    }

    const { error: updateError } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', jobId)
      .eq('organization_id', organization_id)

    if (updateError) {
      failed.push({ id: jobId, code: 'UPDATE_FAILED', message: updateError.message })
      continue
    }
    succeeded.push(jobId)
  }

  return NextResponse.json({
    data: { succeeded, failed },
  })
}
