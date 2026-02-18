import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { parseBulkJobIds, getBulkAuth, type BulkFailedItem } from '../shared'
import { getRequestId } from '@/lib/utils/requestId'

export const runtime = 'nodejs'

/**
 * POST /api/jobs/bulk/assign
 * Assign a worker to multiple jobs. Returns { data: { succeeded, failed, updated_assignments } }.
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)

  const auth = await getBulkAuth(request)
  if ('errorResponse' in auth) return auth.errorResponse
  const { organization_id, user_id } = auth

  const parsed = await parseBulkJobIds(request, false, true)
  if ('errorResponse' in parsed) return parsed.errorResponse
  const { jobIds, workerId } = parsed

  const succeeded: string[] = []
  const failed: BulkFailedItem[] = []
  const updated_assignments: Record<
    string,
    { assigned_to_id: string; assigned_to_name: string | null; assigned_to_email: string | null }
  > = {}

  const supabase = await createSupabaseServerClient()

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

  for (const jobId of jobIds) {
    if (typeof jobId !== 'string') {
      failed.push({ id: String(jobId), code: 'INVALID_ID', message: 'Invalid job id' })
      continue
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, client_name')
      .eq('id', jobId)
      .eq('organization_id', organization_id)
      .single()

    if (jobError || !job) {
      failed.push({ id: jobId, code: 'NOT_FOUND', message: 'Job not found' })
      continue
    }

    const { error: insertError } = await supabase.from('job_assignments').insert({
      job_id: jobId,
      user_id: workerId,
      role: 'worker',
    })

    if (insertError) {
      if (insertError.code === '23505') {
        failed.push({ id: jobId, code: 'ALREADY_ASSIGNED', message: 'User already assigned to this job' })
      } else {
        failed.push({ id: jobId, code: 'ASSIGN_FAILED', message: insertError.message })
      }
      continue
    }

    const { error: updateJobError } = await supabase
      .from('jobs')
      .update({
        assigned_to_id: workerId,
        assigned_to_name: assigneeName,
        assigned_to_email: assigneeEmail,
      })
      .eq('id', jobId)
      .eq('organization_id', organization_id)

    if (updateJobError) {
      // Non-fatal: assignment row created but denormalized fields may not exist on schema
    }

    succeeded.push(jobId)
    updated_assignments[jobId] = {
      assigned_to_id: workerId,
      assigned_to_name: assigneeName,
      assigned_to_email: assigneeEmail,
    }
  }

  return NextResponse.json({
    data: { succeeded, failed, updated_assignments },
  })
}
