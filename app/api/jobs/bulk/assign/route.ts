import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, getBulkClientMetadata, type BulkFailedItem } from '../shared'
import { hasPermission } from '@/lib/utils/permissions'
import { recordAuditLog } from '@/lib/audit/auditLogger'
import { getSessionToken, BACKEND_URL } from '@/lib/api/proxy-helpers'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/bulk/assign
 * Assign a worker to multiple jobs. Uses batched SQL: single select to validate membership,
 * single insert for job_assignments, single update for jobs. Returns { data: { succeeded, failed, updated_assignments } }.
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
    return NextResponse.json({
      data: { succeeded: [], failed, updated_assignments: {} },
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
    return NextResponse.json({
      data: { succeeded: [], failed, updated_assignments: {} },
    })
  }

  const rows = eligibleIds.map((job_id) => ({
    job_id,
    user_id: workerId,
    role: 'worker',
  }))
  const { error: insertError } = await supabase.from('job_assignments').insert(rows)

  let succeeded: string[] = []
  if (insertError) {
    if (insertError.code === '23505') {
      for (const jobId of eligibleIds) {
        const { error: oneError } = await supabase.from('job_assignments').insert({
          job_id: jobId,
          user_id: workerId,
          role: 'worker',
        })
        if (oneError && oneError.code === '23505') {
          failed.push({ id: jobId, code: 'ALREADY_ASSIGNED', message: 'User already assigned to this job' })
        } else if (oneError) {
          failed.push({ id: jobId, code: 'ASSIGN_FAILED', message: oneError.message })
        } else {
          succeeded.push(jobId)
        }
      }
    } else {
      for (const id of eligibleIds) {
        failed.push({ id, code: 'ASSIGN_FAILED', message: insertError.message })
      }
      return NextResponse.json({
        data: { succeeded: [], failed, updated_assignments: {} },
      })
    }
  } else {
    succeeded = [...eligibleIds]
  }

  if (succeeded.length > 0) {
    const { error: updateJobError } = await supabase
      .from('jobs')
      .update({
        assigned_to_id: workerId,
        assigned_to_name: assigneeName,
        assigned_to_email: assigneeEmail,
      })
      .eq('organization_id', organization_id)
      .in('id', succeeded)

    if (updateJobError) {
      // Non-fatal: assignment rows created but denormalized fields may not exist on schema
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
  for (const jobId of succeeded) {
    await recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'worker.assigned',
      targetType: 'job',
      targetId: jobId,
      metadata: { worker_id: workerId, bulk: true, ...clientMeta },
    })
    const job = found.get(jobId)
    try {
      if (token) {
        await fetch(`${BACKEND_URL}/api/notifications/job-assigned`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            userId: workerId,
            jobId,
            jobTitle: job?.client_name ?? undefined,
          }),
        })
      }
    } catch (_) {}
  }

  return NextResponse.json({
    data: { succeeded, failed, updated_assignments },
  })
}
