import { supabase } from '../lib/supabaseClient'
import { tryAcquireWorkerLease, WORKER_LEASE_KEYS } from '../lib/workerLock'
import { getNotificationPreferences } from '../services/notifications'
import { EmailJobType, queueEmail } from './emailQueue'
import type { WeeklyDigestData } from '../emails/WeeklyDigestEmail'

const WEEKLY_DIGEST_WORKER_KEY = 'weekly_digest'

let workerStarted = false
let workerTimer: NodeJS.Timeout | null = null

/** Monday of the given date (ISO weekday week); period_key is that Monday as YYYY-MM-DD. */
function getWeekPeriodKey(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

export async function buildDigestForUser(userId: string, organizationId: string): Promise<WeeklyDigestData> {
  const now = new Date()
  const oneWeekAgo = new Date(now)
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const dueSoonCutoff = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  // Jobs assigned to this user (via job_assignments)
  const { data: assignments } = await supabase
    .from('job_assignments')
    .select('job_id')
    .eq('user_id', userId)

  const jobIds = (assignments || []).map((a) => a.job_id).filter(Boolean)
  if (jobIds.length === 0) {
    return {
      activeJobs: 0,
      completedJobs: 0,
      overdueJobs: 0,
      needsAttention: [],
      completedThisWeek: [],
    }
  }

  // User-scoped: active jobs (assigned to user, not completed/archived)
  const { count: activeJobs } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('id', jobIds)
    .neq('status', 'completed')
    .neq('status', 'archived')

  // User-scoped: completed this week (assigned to user)
  const { data: completedRows } = await supabase
    .from('jobs')
    .select('client_name, updated_at')
    .eq('organization_id', organizationId)
    .in('id', jobIds)
    .eq('status', 'completed')
    .gte('updated_at', oneWeekAgo.toISOString())
    .order('updated_at', { ascending: false })
    .limit(10)

  // User-scoped: overdue jobs (assigned to user)
  const { count: overdueJobs } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('id', jobIds)
    .lt('due_date', now.toISOString())
    .neq('status', 'completed')
    .neq('status', 'archived')

  // User-scoped: needs attention (assigned to user, due soon or overdue)
  const { data: attentionRows } = await supabase
    .from('jobs')
    .select('client_name, due_date')
    .eq('organization_id', organizationId)
    .in('id', jobIds)
    .not('due_date', 'is', null)
    .lte('due_date', dueSoonCutoff.toISOString())
    .neq('status', 'completed')
    .neq('status', 'archived')
    .order('due_date', { ascending: true })
    .limit(20)

  const needsAttention = (attentionRows || []).map((row) => ({
    title: row.client_name || 'Untitled job',
    status:
      row.due_date && new Date(row.due_date).getTime() < now.getTime()
        ? ('overdue' as const)
        : ('due_soon' as const),
  }))

  return {
    activeJobs: activeJobs || 0,
    completedJobs: (completedRows || []).length,
    overdueJobs: overdueJobs || 0,
    needsAttention,
    completedThisWeek: (completedRows || []).map((row) => ({
      title: row.client_name || 'Untitled job',
      completedAt: row.updated_at || now.toISOString(),
    })),
  }
}

async function runWeeklyDigestCycle(): Promise<void> {
  const now = new Date()
  const isMonday = now.getDay() === 1
  if (!isMonday) return

  // Time-of-day guard: run only in 09:00–09:10 local to match required 09:00 schedule; handles restarts within the window.
  const hour = now.getHours()
  const minute = now.getMinutes()
  if (hour !== 9 || minute >= 10) return

  const periodKey = getWeekPeriodKey(now)

  // Persisted guard: run once per week; skip if we already ran this week.
  const { data: existing } = await supabase
    .from('worker_period_runs')
    .select('ran_at')
    .eq('worker_key', WEEKLY_DIGEST_WORKER_KEY)
    .eq('period_key', periodKey)
    .maybeSingle()
  if (existing) return

  const hasLease = await tryAcquireWorkerLease(WORKER_LEASE_KEYS.weekly_digest)
  if (!hasLease) return

  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, organization_id')
    .not('email', 'is', null)
    .is('archived_at', null)

  if (error) {
    console.error('[WeeklyDigestWorker] Failed to load users:', error)
    return
  }

  for (const user of users || []) {
    if (!user.email || !user.organization_id) continue

    const prefs = await getNotificationPreferences(user.id)
    if (!prefs.email_enabled || !prefs.email_weekly_digest) continue

    try {
      const digest = await buildDigestForUser(user.id, user.organization_id)
      await queueEmail(
        EmailJobType.weekly_digest,
        user.email,
        digest as unknown as Record<string, unknown>,
        user.id
      )
    } catch (digestError) {
      console.error('[WeeklyDigestWorker] Failed for user:', user.id, digestError)
    }
  }

  await supabase.from('worker_period_runs').upsert(
    { worker_key: WEEKLY_DIGEST_WORKER_KEY, period_key: periodKey, ran_at: now.toISOString() },
    { onConflict: 'worker_key,period_key' }
  )
  console.log('[WeeklyDigestWorker] Queued weekly digest emails')
}

export function startWeeklyDigestWorker(): void {
  if (workerStarted) {
    console.log('[WeeklyDigestWorker] Already running')
    return
  }

  workerStarted = true
  console.log('[WeeklyDigestWorker] Starting...')

  workerTimer = setInterval(() => {
    runWeeklyDigestCycle().catch((error) => {
      console.error('[WeeklyDigestWorker] Cycle failed:', error)
    })
  }, 60 * 1000)
}

export function stopWeeklyDigestWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer)
    workerTimer = null
  }
  workerStarted = false
}
