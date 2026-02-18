import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, getBulkClientMetadata, buildBulkResults, type BulkFailedItem } from '../shared'
import { hasPermission } from '@/lib/utils/permissions'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getSessionToken, BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/bulk/assign
 * Assign a worker to multiple jobs. Uses atomic RPC (bulk_assign_jobs) to insert job_assignments
 * and update jobs.assigned_to_* and updated_at in one transaction. Audit/notifications run only
 * after commit for returned job ids. Returns { data: { succeeded, failed, updated_assignments } }.
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
      { message: 'You do not have permission to assign jobs' },
      { status: 403 }
    )
  }

  const parsed = await parseBulkJobIds(request, false, true)
  if ('errorResponse' in parsed) return parsed.errorResponse
  const { jobIds, workerId } = parsed

  const validIds = jobIds.filter((id): id is string => typeof id === 'string')
  const failed: BulkFailedItem[] = jobIds
    .filter((id) => typeof id !== 'string')
    .map((id) => ({ id: String(id), code: 'INVALID_ID', message: 'Invalid job id' }))

  const { data: assignee, error: assigneeError } = await supabase
    .from('users')
    .select('id, organization_id, full_name, email')
    .eq('id', workerId)
    .single()

  if (assigneeError || !assignee || assignee.organization_id !== organization_id) {
    return NextResponse.json(
      { message: 'Worker not found or does not belong to your organization' },
      { status: 400 }
    )
  }

  const assigneeName = assignee.full_name ?? null
  const assigneeEmail = assignee.email ?? null

  if (validIds.length === 0) {
    const total = failed.length
    return NextResponse.json({
      success: true,
      summary: { total, succeeded: 0, failed: total },
      data: { succeeded: [], failed, updated_assignments: {} },
      results: buildBulkResults([], failed),
    })
  }

  const { data: jobs, error: fetchError } = await supabase
    .from('jobs')
    .select('id, client_name, deleted_at, archived_at, status')
    .eq('organization_id', organization_id)
    .in('id', validIds)

  if (fetchError) {
    return NextResponse.json(
      { message: fetchError.message, code: 'QUERY_ERROR' },
      { status: 500 }
    )
  }

  type JobRow = { id: string; client_name?: string; deleted_at?: string | null; archived_at?: string | null; status?: string }
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
      failed.push({ id, code: 'ARCHIVED', message: 'Job is archived and cannot be assigned' })
    }
  }

  const eligibleIds = validIds.filter((id) => {
    const j = found.get(id)
    return j && !j.deleted_at && !j.archived_at && j.status !== 'archived'
  })
  if (eligibleIds.length === 0) {
    const total = failed.length
    return NextResponse.json({
      success: true,
      summary: { total, succeeded: 0, failed: total },
      data: { succeeded: [], failed, updated_assignments: {} },
      results: buildBulkResults([], failed),
    })
  }

  const { data: assignedIds, error: rpcError } = await supabase.rpc('bulk_assign_jobs', {
    p_organization_id: organization_id,
    p_job_ids: eligibleIds,
    p_worker_id: workerId,
    p_worker_name: assigneeName,
    p_worker_email: assigneeEmail,
  })

  if (rpcError) {
    for (const id of eligibleIds) {
      failed.push({ id, code: 'ASSIGN_FAILED', message: rpcError.message })
    }
    const total = failed.length
    return NextResponse.json({
      success: true,
      summary: { total, succeeded: 0, failed: total },
      data: { succeeded: [], failed, updated_assignments: {} },
      results: buildBulkResults([], failed),
    })
  }

  const succeeded = Array.isArray(assignedIds)
    ? (assignedIds as string[])
    : assignedIds
      ? ([assignedIds] as string[])
      : []
  for (const id of eligibleIds) {
    if (!succeeded.includes(id)) {
      failed.push({ id, code: 'ASSIGN_FAILED', message: 'Job was not assigned' })
    }
  }

  const updated_assignments: Record<
    string,
    { assigned_to_id: string; assigned_to_name: string | null; assigned_to_email: string | null }
  > = {}
  for (const id of succeeded) {
    updated_assignments[id] = {
      assigned_to_id: workerId,
      assigned_to_name: assigneeName,
      assigned_to_email: assigneeEmail,
    }
  }

  const clientMeta = getBulkClientMetadata(request)
  const token = await getSessionToken(request)
  const auditAndNotifyPromises = succeeded.map((jobId) => {
    const job = found.get(jobId)
    const auditPromise = recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'worker.assigned',
      targetType: 'job',
      targetId: jobId,
      metadata: { worker_id: workerId, bulk: true, ...clientMeta },
    })
    const notifyPromise = token
      ? fetch(`${BACKEND_URL}/api/notifications/job-assigned`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            userId: workerId,
            jobId,
            jobTitle: job?.client_name ?? undefined,
          }),
        })
      : Promise.resolve()
    return Promise.allSettled([auditPromise, notifyPromise])
  })
  await Promise.allSettled(auditAndNotifyPromises)

  const total = succeeded.length + failed.length
  return NextResponse.json({
    success: true,
    summary: { total, succeeded: succeeded.length, failed: failed.length },
    data: { succeeded, failed, updated_assignments },
    results: buildBulkResults(succeeded, failed),
  })
}
