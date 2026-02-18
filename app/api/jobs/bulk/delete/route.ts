import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, type BulkFailedItem } from '../shared'
import { getRequestId } from '@/lib/utils/requestId'
import { hasPermission } from '@/lib/utils/permissions'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/bulk/delete
 * Soft-delete multiple jobs (draft-only, no audit/evidence/risk/reports). Returns { data: { succeeded, failed } }.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

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
  if (!hasPermission(role, 'jobs.delete')) {
    return NextResponse.json(
      { message: 'You do not have permission to delete jobs' },
      { status: 403 }
    )
  }

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
      failed.push({ id: jobId, code: 'ALREADY_DELETED', message: 'Job has already been deleted' })
      continue
    }
    if (job.status !== 'draft') {
      failed.push({
        id: jobId,
        code: 'NOT_ELIGIBLE_FOR_DELETE',
        message: 'Only draft jobs can be deleted',
      })
      continue
    }

    const [auditRes, docRes, riskRes, reportRes] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('id')
        .eq('organization_id', organization_id)
        .or(`target_id.eq.${jobId},metadata->>job_id.eq.${jobId}`)
        .limit(1),
      supabase.from('documents').select('id').eq('job_id', jobId).limit(1),
      supabase.from('job_risk_scores').select('id').eq('job_id', jobId).limit(1),
      supabase.from('reports').select('id').eq('job_id', jobId).limit(1),
    ])

    if ((auditRes.data?.length ?? 0) > 0) {
      failed.push({
        id: jobId,
        code: 'HAS_AUDIT_HISTORY',
        message: 'Jobs with audit history cannot be deleted',
      })
      continue
    }
    if ((docRes.data?.length ?? 0) > 0) {
      failed.push({
        id: jobId,
        code: 'HAS_EVIDENCE',
        message: 'Jobs with uploaded evidence cannot be deleted',
      })
      continue
    }
    if ((riskRes.data?.length ?? 0) > 0) {
      failed.push({
        id: jobId,
        code: 'HAS_RISK_ASSESSMENT',
        message: 'Jobs with finalized risk assessments cannot be deleted',
      })
      continue
    }
    if ((reportRes.data?.length ?? 0) > 0) {
      failed.push({
        id: jobId,
        code: 'HAS_REPORTS',
        message: 'Jobs with generated reports cannot be deleted',
      })
      continue
    }

    const { error: deleteError } = await supabase
      .from('jobs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('organization_id', organization_id)

    if (deleteError) {
      failed.push({ id: jobId, code: 'DELETE_FAILED', message: deleteError.message })
      continue
    }
    succeeded.push(jobId)
  }

  return NextResponse.json({
    data: { succeeded, failed },
  })
}
