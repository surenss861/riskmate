import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, getBulkClientMetadata, type BulkFailedItem } from '../shared'
import { hasJobsDeletePermission } from '@/lib/utils/permissions'
import { recordAuditLog } from '@/lib/audit/auditLogger'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/bulk/delete
 * Soft-delete multiple jobs (draft-only, no audit/risk/reports). Related documents and evidence
 * are cascade soft-deleted in the same transaction. Uses RPC bulk_soft_delete_jobs for atomic
 * updates. Returns { data: { succeeded, failed } }.
 */
export async function POST(request: NextRequest) {
  const auth = await getBulkAuth(request)
  if ('errorResponse' in auth) return auth.errorResponse
  const { organization_id, user_id } = auth

  const parsed = await parseBulkJobIds(request)
  if ('errorResponse' in parsed) return parsed.errorResponse
  const { jobIds } = parsed

  const supabase = await createSupabaseServerClient()

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user_id)
    .single()

  const role = (userData?.role as string) ?? 'member'
  if (!hasJobsDeletePermission(role)) {
    return NextResponse.json(
      { message: 'You do not have permission to delete jobs' },
      { status: 403 }
    )
  }

  const validIds = jobIds.filter((id): id is string => typeof id === 'string')
  const failed: BulkFailedItem[] = jobIds
    .filter((id) => typeof id !== 'string')
    .map((id) => ({ id: String(id), code: 'INVALID_ID', message: 'Invalid job id' }))

  if (validIds.length === 0) {
    return NextResponse.json({ data: { succeeded: [], failed } })
  }

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, status, archived_at, deleted_at')
    .eq('organization_id', organization_id)
    .in('id', validIds)

  if (jobsError) {
    return NextResponse.json(
      { message: jobsError.message, code: 'QUERY_ERROR' },
      { status: 500 }
    )
  }

  const jobMap = new Map((jobs ?? []).map((j: { id: string; status: string; deleted_at: string | null }) => [j.id, j]))

  for (const id of validIds) {
    if (!jobMap.has(id)) {
      failed.push({ id, code: 'NOT_FOUND', message: 'Job not found' })
      continue
    }
    const job = jobMap.get(id)!
    if (job.deleted_at) {
      failed.push({ id, code: 'ALREADY_DELETED', message: 'Job has already been deleted' })
      continue
    }
    if (job.status !== 'draft') {
      failed.push({
        id,
        code: 'NOT_ELIGIBLE_FOR_DELETE',
        message: 'Only draft jobs can be deleted',
      })
    }
  }

  const draftNotDeleted = validIds.filter((id) => {
    const j = jobMap.get(id)
    return j && !j.deleted_at && j.status === 'draft'
  })

  if (draftNotDeleted.length === 0) {
    return NextResponse.json({ data: { succeeded: [], failed } })
  }

  const [
    auditByTarget,
    auditByJobId,
    riskRes,
    reportRes,
  ] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('target_id')
      .eq('organization_id', organization_id)
      .in('target_id', draftNotDeleted),
    supabase
      .from('audit_logs')
      .select('job_id')
      .eq('organization_id', organization_id)
      .in('job_id', draftNotDeleted)
      .not('job_id', 'is', null),
    supabase.from('job_risk_scores').select('job_id').in('job_id', draftNotDeleted),
    supabase.from('reports').select('job_id').in('job_id', draftNotDeleted),
  ])

  const hasAuditByTarget = new Set(
    (auditByTarget.data ?? []).map((r: { target_id: string }) => r.target_id)
  )
  const hasAuditByJobId = new Set(
    (auditByJobId.data ?? []).map((r: { job_id: string }) => r.job_id).filter(Boolean)
  )
  const hasRisk = new Set((riskRes.data ?? []).map((r: { job_id: string }) => r.job_id))
  const hasReports = new Set((reportRes.data ?? []).map((r: { job_id: string }) => r.job_id))

  const ineligibleAudit = new Set([...hasAuditByTarget, ...hasAuditByJobId])

  const eligibleIds: string[] = []
  for (const id of draftNotDeleted) {
    if (ineligibleAudit.has(id)) {
      failed.push({
        id,
        code: 'HAS_AUDIT_HISTORY',
        message: 'Jobs with audit history cannot be deleted',
      })
      continue
    }
    if (hasRisk.has(id)) {
      failed.push({
        id,
        code: 'HAS_RISK_ASSESSMENT',
        message: 'Jobs with finalized risk assessments cannot be deleted',
      })
      continue
    }
    if (hasReports.has(id)) {
      failed.push({
        id,
        code: 'HAS_REPORTS',
        message: 'Jobs with generated reports cannot be deleted',
      })
      continue
    }
    eligibleIds.push(id)
  }

  if (eligibleIds.length === 0) {
    return NextResponse.json({ data: { succeeded: [], failed } })
  }

  const deletedAt = new Date().toISOString()
  const { error: rpcError } = await supabase.rpc('bulk_soft_delete_jobs', {
    p_organization_id: organization_id,
    p_job_ids: eligibleIds,
    p_deleted_at: deletedAt,
  })

  if (rpcError) {
    for (const id of eligibleIds) {
      failed.push({ id, code: 'DELETE_FAILED', message: rpcError.message })
    }
    return NextResponse.json({ data: { succeeded: [], failed } })
  }

  const clientMeta = getBulkClientMetadata(request)
  const auditPromises = eligibleIds.map((jobId) => {
    const job = jobMap.get(jobId)!
    return recordAuditLog(supabase, {
      organizationId: organization_id,
      actorId: user_id,
      eventName: 'job.deleted',
      targetType: 'job',
      targetId: jobId,
      metadata: { previous_status: job.status, bulk: true, ...clientMeta },
    })
  })
  await Promise.allSettled(auditPromises)

  return NextResponse.json({
    data: { succeeded: eligibleIds, failed },
  })
}
