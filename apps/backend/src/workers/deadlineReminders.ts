import { supabase } from '../lib/supabaseClient'
import { tryAcquireWorkerLease, WORKER_LEASE_KEYS } from '../lib/workerLock'
import { getNotificationPreferences } from '../services/notifications'
import { EmailJobType, queueEmail } from './emailQueue'

const DEADLINE_REMINDER_WORKER_KEY = 'deadline_reminder'

/** Today as YYYY-MM-DD (local) for worker_period_runs. */
function getTodayPeriodKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

let workerStarted = false
let workerTimer: NodeJS.Timeout | null = null

async function runDeadlineReminderCycle(): Promise<void> {
  const now = new Date()
  const periodKey = getTodayPeriodKey(now)

  // Persisted guard: run once per day; skip if we already ran today. No narrow time window —
  // if the window was missed (e.g. restart after 08:01) we still run on the next tick so reminders send.
  const { data: existing } = await supabase
    .from('worker_period_runs')
    .select('ran_at')
    .eq('worker_key', DEADLINE_REMINDER_WORKER_KEY)
    .eq('period_key', periodKey)
    .maybeSingle()
  if (existing) return

  const hasLease = await tryAcquireWorkerLease(WORKER_LEASE_KEYS.deadline_reminder)
  if (!hasLease) return

  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, organization_id, client_name, due_date, status')
    .not('due_date', 'is', null)
    .gte('due_date', now.toISOString())
    .lte('due_date', in24h.toISOString())
    .neq('status', 'completed')
    .neq('status', 'archived')

  if (error) {
    console.error('[DeadlineReminderWorker] Failed to load due jobs:', error)
    return
  }

  for (const job of jobs || []) {
    const dueDate = job.due_date ? new Date(job.due_date) : null
    if (!dueDate || !job.organization_id) continue

    const hoursRemaining = (dueDate.getTime() - now.getTime()) / (60 * 60 * 1000)

    const { data: assignments, error: assignmentError } = await supabase
      .from('job_assignments')
      .select('user_id, users!inner(id, email)')
      .eq('job_id', job.id)
      .eq('organization_id', job.organization_id)

    if (assignmentError) {
      console.error('[DeadlineReminderWorker] Failed to load assignments for job', job.id, assignmentError)
      continue
    }

    for (const assignment of assignments || []) {
      const user = assignment.users as { id: string; email: string | null } | { id: string; email: string | null }[]
      const userData = Array.isArray(user) ? user[0] : user
      if (!userData?.email) continue

      const prefs = await getNotificationPreferences(assignment.user_id)
      if (!prefs.email_enabled || !prefs.email_deadline_reminder) continue

      await queueEmail(
        EmailJobType.deadline_reminder,
        userData.email,
        {
          job: {
            id: job.id,
            title: job.client_name,
            client_name: job.client_name,
            due_date: job.due_date,
          },
          hoursRemaining,
        },
        assignment.user_id
      )
    }
  }

  await supabase.from('worker_period_runs').upsert(
    { worker_key: DEADLINE_REMINDER_WORKER_KEY, period_key: periodKey, ran_at: now.toISOString() },
    { onConflict: 'worker_key,period_key' }
  )
  console.log('[DeadlineReminderWorker] Queued daily deadline reminder emails')
}

export function startDeadlineReminderWorker(): void {
  if (workerStarted) {
    console.log('[DeadlineReminderWorker] Already running')
    return
  }

  workerStarted = true
  console.log('[DeadlineReminderWorker] Starting...')

  workerTimer = setInterval(() => {
    runDeadlineReminderCycle().catch((error) => {
      console.error('[DeadlineReminderWorker] Cycle failed:', error)
    })
  }, 60 * 1000)
}

export function stopDeadlineReminderWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
  }
  workerStarted = false
}
