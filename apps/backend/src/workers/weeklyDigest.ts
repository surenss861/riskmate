import { supabase } from '../lib/supabaseClient'
import { tryAcquireWorkerLease, WORKER_LEASE_KEYS } from '../lib/workerLock'
import { getNotificationPreferences } from '../services/notifications'
import { EmailJobType, queueEmail } from './emailQueue'
import type { WeeklyDigestData } from '../emails/WeeklyDigestEmail'

let workerStarted = false
let workerTimer: NodeJS.Timeout | null = null
let lastRunWindowKey: string | null = null

async function buildDigestForUser(userId: string, organizationId: string): Promise<WeeklyDigestData> {
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
  const inWindow = now.getHours() === 9 && now.getMinutes() <= 1
  if (!isMonday || !inWindow) return

  const windowKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-09`
  if (windowKey === lastRunWindowKey) return

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
      queueEmail(
        EmailJobType.weekly_digest,
        user.email,
        digest as unknown as Record<string, unknown>,
        user.id
      )
    } catch (digestError) {
      console.error('[WeeklyDigestWorker] Failed for user:', user.id, digestError)
    }
  }

  lastRunWindowKey = windowKey
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
