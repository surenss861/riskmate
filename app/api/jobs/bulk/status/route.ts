import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, getBulkClientMetadata, type BulkFailedItem } from '../shared'
import { getRequestId } from '@/lib/utils/requestId'
import { hasPermission } from '@/lib/utils/permissions'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { emitJobEvent } from '@/lib/realtime/emitJobEvent'

export const runtime = 'nodejs'

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
      { message: 'You do not have permission to update job status' },
      { status: 403 }
    )
  }

  const parsed = await parseBulkJobIds(request, true)
  if ('errorResponse' in parsed) return parsed.errorResponse
  const { jobIds, status } = parsed

  const succeeded: string[] = []
  const failed: BulkFailedItem[] = []

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
    const clientMeta = getBulkClientMetadata(request)
    await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'job.updated',
      targetType: 'job',
      targetId: jobId,
      metadata: { status, bulk: true, ...clientMeta },
    })
    await emitJobEvent(organization_id, 'job.updated', jobId, user_id)
  }

  return NextResponse.json({
    data: { succeeded, failed },
  })
}
