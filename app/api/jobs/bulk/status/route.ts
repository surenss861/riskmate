import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, getBulkClientMetadata, buildBulkResults, type BulkFailedItem } from '../shared'
import { hasPermission } from '@/lib/utils/permissions'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { emitJobEvent } from '@/lib/realtime/emitJobEvent'
import { triggerWebhookEvent } from '@/lib/webhooks/trigger'

export const runtime = 'nodejs'

/**
 * Webhook ownership: This Next.js route owns webhook emission for web-client bulk status
 * operations (job.updated, job.completed). The web client calls this route via nextApiRequest.
 * Express bulk routes (POST /api/jobs/bulk/status) own emission for mobile/direct API clients.
 * Do not proxy this route to Express for the same request — each path must emit from one stack only to avoid duplicate deliveries.
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
      { message: 'You do not have permission to update job status' },
      { status: 403 }
    )
  }

  const parsed = await parseBulkJobIds(request, true)
  if ('errorResponse' in parsed) return parsed.errorResponse
  const { jobIds, status } = parsed

  const validIds = jobIds.filter((id): id is string => typeof id === 'string')
  const invalid = jobIds.filter((id) => typeof id !== 'string')
  const failed: BulkFailedItem[] = invalid.map((id) => ({
    id: String(id),
    code: 'INVALID_ID',
    message: 'Invalid job id',
  }))

  if (validIds.length === 0) {
    const total = failed.length
    return NextResponse.json({
      success: true,
      summary: { total, succeeded: 0, failed: total },
      data: { succeeded: [], failed },
      results: buildBulkResults([], failed),
    })
  }

  const { data: jobs, error: fetchError } = await supabase
    .from('jobs')
    .select('id, status, archived_at, deleted_at')
    .eq('organization_id', organization_id)
    .in('id', validIds)

  if (fetchError) {
    return NextResponse.json(
      { message: fetchError.message, code: 'QUERY_ERROR' },
      { status: 500 }
    )
  }

  type JobRow = { id: string; status?: string; archived_at?: string | null; deleted_at?: string | null }
  const found = new Map((jobs ?? []).map((j: JobRow) => [j.id, j]))
  for (const id of validIds) {
    if (!found.has(id)) {
      failed.push({ id, code: 'NOT_FOUND', message: 'Job not found' })
      continue
    }
    const job = found.get(id)!
    if (job.deleted_at) {
      failed.push({ id, code: 'ALREADY_DELETED', message: 'Job has been deleted' })
      continue
    }
    if (job.archived_at || job.status === 'archived') {
      failed.push({ id, code: 'ARCHIVED', message: 'Job is archived and cannot be updated' })
    }
  }

  const eligibleIds = validIds.filter((id) => {
    const j = found.get(id)
    if (!j || j.deleted_at) return false
    if (j.archived_at || j.status === 'archived') return false
    return true
  })

  if (eligibleIds.length === 0) {
    const total = failed.length
    return NextResponse.json({
      success: true,
      summary: { total, succeeded: 0, failed: total },
      data: { succeeded: [], failed },
      results: buildBulkResults([], failed),
    })
  }

  const { data: updatedIds, error: rpcError } = await supabase.rpc('bulk_update_job_status', {
    p_organization_id: organization_id,
    p_job_ids: eligibleIds,
    p_status: status,
  })

  if (rpcError) {
    for (const id of eligibleIds) {
      failed.push({ id, code: 'UPDATE_FAILED', message: rpcError.message })
    }
    const total = failed.length
    return NextResponse.json(
      {
        success: false,
        message: rpcError.message,
        code: 'RPC_ERROR',
        summary: { total, succeeded: 0, failed: total },
        data: { succeeded: [], failed },
        results: buildBulkResults([], failed),
      },
      { status: 500 }
    )
  }

  const succeeded = Array.isArray(updatedIds)
    ? (updatedIds as string[])
    : updatedIds
      ? ([updatedIds] as string[])
      : []

  const clientMeta = getBulkClientMetadata(request)
  const sideEffectPromises = succeeded.flatMap((jobId) => [
    recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'job.updated',
      targetType: 'job',
      targetId: jobId,
      metadata: { status, bulk: true, ...clientMeta },
    }),
    emitJobEvent(organization_id, 'job.updated', jobId, user_id),
  ])
  await Promise.allSettled(sideEffectPromises)

  const completedAt = status === 'completed' ? new Date().toISOString() : undefined
  const webhookPromises: Array<{ jobId: string; event: 'job.updated' | 'job.completed'; promise: Promise<unknown> }> = []
  for (const jobId of succeeded) {
    const previousStatus = found.get(jobId)?.status
    const payload = { id: jobId, status, ...(completedAt != null ? { completed_at: completedAt } : {}) }
    webhookPromises.push({
      jobId,
      event: 'job.updated',
      promise: triggerWebhookEvent(organization_id, 'job.updated', payload).catch((e) =>
        console.warn('[Webhook] job.updated trigger failed:', e)
      ),
    })
    if (status === 'completed' && previousStatus !== 'completed') {
      webhookPromises.push({
        jobId,
        event: 'job.completed',
        promise: triggerWebhookEvent(organization_id, 'job.completed', payload).catch((e) =>
          console.warn('[Webhook] job.completed trigger failed:', e)
        ),
      })
    }
  }
  const webhookResults = await Promise.allSettled(webhookPromises.map((w) => w.promise))
  webhookResults.forEach((result, i) => {
    if (result.status === 'rejected') {
      const { jobId, event } = webhookPromises[i]
      console.warn('[Webhook] bulk enqueue failed', { jobId, event, error: result.reason })
    }
  })

  for (const id of eligibleIds) {
    if (!succeeded.includes(id)) {
      failed.push({ id, code: 'UPDATE_FAILED', message: 'Job was not updated' })
    }
  }

  const total = succeeded.length + failed.length
  return NextResponse.json({
    success: true,
    summary: { total, succeeded: succeeded.length, failed: failed.length },
    data: { succeeded, failed },
    results: buildBulkResults(succeeded, failed),
  })
}
