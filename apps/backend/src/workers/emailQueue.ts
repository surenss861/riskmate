import crypto from 'crypto'
import {
  sendDeadlineReminderEmail,
  sendJobAssignedEmail,
  sendMentionEmail,
  sendReportReadyEmail,
  sendSignatureRequestEmail,
  sendTaskAssignedEmail,
  sendTaskCompletedEmail,
  sendTaskReminderEmail,
  sendTeamInviteEmail,
  sendWeeklyDigestEmail,
  sendWelcomeEmail,
} from '../utils/email'
import { supabase } from '../lib/supabaseClient'
import { tryAcquireWorkerLease, WORKER_LEASE_KEYS } from '../lib/workerLock'
import type { WeeklyDigestData } from '../emails/WeeklyDigestEmail'

const LEASE_VISIBILITY_SEC = 120
const MAX_CLAIM = 10
const MAX_ATTEMPTS = 3

/** Domain identifier (task/job/report id) from email job data; null when not applicable. */
function getDomainJobId(job: EmailJob): string | null {
  const d = job.data
  switch (job.type) {
    case EmailJobType.job_assigned:
    case EmailJobType.deadline_reminder: {
      const raw = d.job as Record<string, unknown> | undefined
      return typeof raw?.id === 'string' ? raw.id : null
    }
    case EmailJobType.signature_request:
    case EmailJobType.report_ready:
      return typeof d.reportRunId === 'string' ? d.reportRunId : null
    case EmailJobType.mention:
      return typeof d.jobId === 'string' ? d.jobId : null
    case EmailJobType.task_reminder:
    case EmailJobType.task_assigned:
    case EmailJobType.task_completed:
      return typeof d.taskId === 'string' ? d.taskId : typeof d.jobId === 'string' ? d.jobId : null
    default:
      return null
  }
}

/** Log email event to console and optionally to email_logs table (if present). */
async function logEmailEvent(
  domainJobId: string | null,
  queueId: string,
  type: string,
  to: string,
  userId: string | undefined,
  status: 'sent' | 'failed' | 'bounced',
  errorMessage?: string
): Promise<void> {
  const payload = { domainJobId, queueId, type, to, userId, status, errorMessage }
  if (status === 'sent') {
    console.info('[EmailQueue] Sent', payload)
  } else {
    console.error('[EmailQueue] Event', payload)
  }
  try {
    await supabase.from('email_logs').insert({
      job_id: domainJobId,
      queue_id: queueId,
      type,
      recipient: to,
      user_id: userId ?? null,
      status,
      error_message: errorMessage ?? null,
    })
  } catch (e) {
    // Table may not exist yet; avoid breaking the queue
    if (status !== 'sent') console.error('[EmailQueue] email_logs insert failed', e)
  }
}

export enum EmailJobType {
  job_assigned = 'job_assigned',
  signature_request = 'signature_request',
  report_ready = 'report_ready',
  welcome = 'welcome',
  team_invite = 'team_invite',
  mention = 'mention',
  weekly_digest = 'weekly_digest',
  deadline_reminder = 'deadline_reminder',
  task_reminder = 'task_reminder',
  task_assigned = 'task_assigned',
  task_completed = 'task_completed',
}

export interface EmailJob {
  id: string
  type: EmailJobType
  to: string
  userId?: string
  data: Record<string, unknown>
  scheduledAt?: Date
  attempts: number
  createdAt: Date
}

let workerStarted = false
let workerTimer: NodeJS.Timeout | null = null
let processing = false

/** Row returned from email_queue table (and from claim_email_queue_jobs RPC). */
interface EmailQueueRow {
  id: string
  type: string
  recipient: string
  user_id: string | null
  data: Record<string, unknown>
  scheduled_at: string
  attempts: number
  created_at: string
  lease_holder: string | null
  lease_expires_at: string | null
}

function rowToJob(row: EmailQueueRow): EmailJob {
  return {
    id: row.id,
    type: row.type as EmailJobType,
    to: row.recipient,
    userId: row.user_id ?? undefined,
    data: row.data ?? {},
    scheduledAt: new Date(row.scheduled_at),
    attempts: row.attempts,
    createdAt: new Date(row.created_at),
  }
}

export async function queueEmail(
  type: EmailJobType,
  to: string,
  data: Record<string, unknown>,
  userId?: string,
  scheduledAt?: Date
): Promise<EmailJob> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const scheduled = (scheduledAt ?? new Date()).toISOString()

  const { error } = await supabase.from('email_queue').insert({
    id,
    type,
    recipient: to,
    user_id: userId ?? null,
    data: data ?? {},
    scheduled_at: scheduled,
    attempts: 0,
    created_at: now,
  })

  if (error) {
    console.error('[EmailQueue] Insert failed:', error)
    throw new Error(`Email queue insert failed: ${error.message}`)
  }

  return {
    id,
    type,
    to,
    userId,
    data,
    scheduledAt: scheduledAt ? new Date(scheduled) : undefined,
    attempts: 0,
    createdAt: new Date(now),
  }
}

function deriveName(email: string): string {
  const local = email.split('@')[0] || 'there'
  return local.replace(/[._-]/g, ' ')
}

async function loadUserName(userId: string | undefined, fallbackEmail: string): Promise<string> {
  if (!userId) return deriveName(fallbackEmail)
  const { data } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()

  return (data?.full_name as string | null) || deriveName(fallbackEmail)
}

/** Returns true if an email was actually dispatched; false if skipped (e.g. user preferences). */
async function processJob(job: EmailJob): Promise<boolean> {
  const userName = await loadUserName(job.userId, job.to)

  if (job.type === EmailJobType.job_assigned) {
    if (!job.userId) throw new Error('job_assigned requires userId')
    const assignedByName = String(job.data.assignedByName || 'A teammate')
    const rawJob = (job.data.job as Record<string, unknown>) || {}
    return sendJobAssignedEmail(
      job.to,
      String(job.data.userName || userName),
      {
        id: typeof rawJob.id === 'string' ? rawJob.id : undefined,
        title: typeof rawJob.title === 'string' ? rawJob.title : null,
        client_name: typeof rawJob.client_name === 'string' ? rawJob.client_name : null,
        location: typeof rawJob.location === 'string' ? rawJob.location : null,
        due_date: typeof rawJob.due_date === 'string' ? rawJob.due_date : null,
        risk_level: typeof rawJob.risk_level === 'string' ? rawJob.risk_level : null,
      },
      assignedByName,
      job.userId
    )
  }

  if (job.type === EmailJobType.signature_request) {
    if (!job.userId) throw new Error('signature_request requires userId')
    const reportRunId = String(job.data.reportRunId || '')
    return sendSignatureRequestEmail(
      job.to,
      userName,
      String(job.data.reportName || `Report ${reportRunId.slice(0, 8)}`),
      String(job.data.jobTitle || 'Risk report'),
      reportRunId,
      typeof job.data.deadline === 'string' ? job.data.deadline : undefined,
      job.userId
    )
  }

  if (job.type === EmailJobType.report_ready) {
    if (!job.userId) throw new Error('report_ready requires userId')
    return sendReportReadyEmail(
      job.to,
      userName,
      String(job.data.jobTitle || 'Risk report'),
      String(job.data.downloadUrl || ''),
      String(job.data.viewUrl || String(job.data.downloadUrl || '')),
      job.userId
    )
  }

  if (job.type === EmailJobType.welcome) {
    return sendWelcomeEmail(job.to, userName, job.userId)
  }

  if (job.type === EmailJobType.team_invite) {
    return sendTeamInviteEmail(
      job.to,
      String(job.data.orgName || 'your organization'),
      String(job.data.inviterName || 'A teammate'),
      String(job.data.tempPassword || ''),
      String(job.data.loginUrl || process.env.FRONTEND_URL || 'https://www.riskmate.dev'),
      job.userId
    )
  }

  if (job.type === EmailJobType.mention) {
    if (!job.userId) throw new Error('mention requires userId')
    return sendMentionEmail(
      job.to,
      userName,
      String(job.data.mentionedByName || 'A teammate'),
      String(job.data.jobName || 'a job'),
      String(job.data.commentPreview || ''),
      String(job.data.commentUrl || process.env.FRONTEND_URL || 'https://www.riskmate.dev'),
      job.userId
    )
  }

  if (job.type === EmailJobType.weekly_digest) {
    if (!job.userId) throw new Error('weekly_digest requires userId')
    return sendWeeklyDigestEmail(job.to, userName, job.data as unknown as WeeklyDigestData, job.userId)
  }

  if (job.type === EmailJobType.deadline_reminder) {
    if (!job.userId) throw new Error('deadline_reminder requires userId')
    const rawJob = (job.data.job as Record<string, unknown>) || {}
    return sendDeadlineReminderEmail(
      job.to,
      userName,
      {
        id: typeof rawJob.id === 'string' ? rawJob.id : undefined,
        title: typeof rawJob.title === 'string' ? rawJob.title : null,
        client_name: typeof rawJob.client_name === 'string' ? rawJob.client_name : null,
        due_date: typeof rawJob.due_date === 'string' ? rawJob.due_date : null,
      },
      Number(job.data.hoursRemaining || 0),
      job.userId
    )
  }

  if (job.type === EmailJobType.task_reminder) {
    if (!job.userId) throw new Error('task_reminder requires userId')
    return sendTaskReminderEmail(
      job.to,
      userName,
      {
        taskTitle: String(job.data.taskTitle || ''),
        jobTitle: String(job.data.jobTitle || 'Job'),
        dueDate: typeof job.data.dueDate === 'string' ? job.data.dueDate : null,
        isOverdue: Boolean(job.data.isOverdue),
        hoursRemaining:
          typeof job.data.hoursRemaining === 'number' ? job.data.hoursRemaining : undefined,
        jobId: typeof job.data.jobId === 'string' ? job.data.jobId : undefined,
        taskId: typeof job.data.taskId === 'string' ? job.data.taskId : undefined,
      },
      job.userId
    )
  }

  if (job.type === EmailJobType.task_assigned) {
    if (!job.userId) throw new Error('task_assigned requires userId')
    return sendTaskAssignedEmail(
      job.to,
      userName,
      {
        taskTitle: String(job.data.taskTitle || ''),
        jobTitle: String(job.data.jobTitle || 'Job'),
        jobId: String(job.data.jobId || ''),
        taskId: String(job.data.taskId || ''),
      },
      job.userId
    )
  }

  if (job.type === EmailJobType.task_completed) {
    if (!job.userId) throw new Error('task_completed requires userId')
    return sendTaskCompletedEmail(
      job.to,
      userName,
      {
        taskTitle: String(job.data.taskTitle || ''),
        jobTitle: String(job.data.jobTitle || 'Job'),
        taskId: String(job.data.taskId || ''),
        jobId: String(job.data.jobId ?? ''),
      },
      job.userId
    )
  }

  throw new Error(`Unsupported email job type: ${job.type}`)
}

async function runQueueCycle(): Promise<void> {
  if (processing) return
  const hasLease = await tryAcquireWorkerLease(WORKER_LEASE_KEYS.email_queue, 60)
  if (!hasLease) return
  processing = true

  const holderId = `${process.pid}-${crypto.randomUUID().slice(0, 8)}`

  try {
    const { data: rows, error: claimError } = await supabase.rpc('claim_email_queue_jobs', {
      p_holder_id: holderId,
      p_visibility_sec: LEASE_VISIBILITY_SEC,
      p_max: MAX_CLAIM,
    })

    if (claimError) {
      // Table or RPC may not exist yet (e.g. before migration)
      if (claimError.code !== 'PGRST204' && claimError.message?.includes('claim_email_queue_jobs') === false) {
        console.error('[EmailQueue] Claim failed:', claimError)
      }
      return
    }

    const claimed = (rows ?? []) as EmailQueueRow[]
    for (const row of claimed) {
      const job = rowToJob(row)
      const domainJobId = getDomainJobId(job)

      try {
        const dispatched = await processJob(job)
        if (dispatched) {
          await logEmailEvent(domainJobId, job.id, job.type, job.to, job.userId, 'sent')
        }
        await supabase.from('email_queue').delete().eq('id', job.id)
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        const newAttempts = job.attempts + 1

        if (newAttempts >= MAX_ATTEMPTS) {
          await logEmailEvent(domainJobId, job.id, job.type, job.to, job.userId, 'failed', errMsg)
          await supabase.from('email_queue').delete().eq('id', job.id)
          console.error('[EmailQueue] Job failed and removed after 3 attempts:', {
            id: job.id,
            type: job.type,
            to: job.to,
            error,
          })
        } else {
          const backoffSec = 2 ** (newAttempts - 1)
          const scheduledAt = new Date(Date.now() + backoffSec * 1000).toISOString()
          await supabase
            .from('email_queue')
            .update({
              attempts: newAttempts,
              scheduled_at: scheduledAt,
              lease_holder: null,
              lease_expires_at: null,
            })
            .eq('id', job.id)
          console.error('[EmailQueue] Job failed, will retry after backoff:', {
            id: job.id,
            type: job.type,
            attempts: newAttempts,
            nextAttemptAt: scheduledAt,
            error,
          })
        }
      }
    }
  } finally {
    processing = false
  }
}

export function startEmailQueueWorker(): void {
  if (workerStarted) {
    console.log('[EmailQueue] Already running')
    return
  }

  workerStarted = true
  console.log('[EmailQueue] Starting...')
  runQueueCycle().catch((error) => {
    console.error('[EmailQueue] Initial cycle failed:', error)
  })

  workerTimer = setInterval(() => {
    runQueueCycle().catch((error) => {
      console.error('[EmailQueue] Queue cycle failed:', error)
    })
  }, 5000)
}

export function stopEmailQueueWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
  }
  workerStarted = false
}
