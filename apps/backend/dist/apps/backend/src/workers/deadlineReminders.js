"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDeadlineReminderWorker = startDeadlineReminderWorker;
exports.stopDeadlineReminderWorker = stopDeadlineReminderWorker;
const supabaseClient_1 = require("../lib/supabaseClient");
const workerLock_1 = require("../lib/workerLock");
const notifications_1 = require("../services/notifications");
const emailQueue_1 = require("./emailQueue");
const DEADLINE_REMINDER_WORKER_KEY = 'deadline_reminder';
/** Today as YYYY-MM-DD (local) for worker_period_runs. */
function getTodayPeriodKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
let workerStarted = false;
let workerTimer = null;
async function runDeadlineReminderCycle() {
    const now = new Date();
    const inWindow = now.getHours() === 8 && now.getMinutes() <= 1;
    if (!inWindow)
        return;
    const periodKey = getTodayPeriodKey(now);
    // Persisted guard: run once per day even after restart; skip if we already ran today.
    const { data: existing } = await supabaseClient_1.supabase
        .from('worker_period_runs')
        .select('ran_at')
        .eq('worker_key', DEADLINE_REMINDER_WORKER_KEY)
        .eq('period_key', periodKey)
        .maybeSingle();
    if (existing)
        return;
    const hasLease = await (0, workerLock_1.tryAcquireWorkerLease)(workerLock_1.WORKER_LEASE_KEYS.deadline_reminder);
    if (!hasLease)
        return;
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { data: jobs, error } = await supabaseClient_1.supabase
        .from('jobs')
        .select('id, organization_id, client_name, due_date, status')
        .not('due_date', 'is', null)
        .gte('due_date', now.toISOString())
        .lte('due_date', in24h.toISOString())
        .neq('status', 'completed')
        .neq('status', 'archived');
    if (error) {
        console.error('[DeadlineReminderWorker] Failed to load due jobs:', error);
        return;
    }
    for (const job of jobs || []) {
        const dueDate = job.due_date ? new Date(job.due_date) : null;
        if (!dueDate || !job.organization_id)
            continue;
        const hoursRemaining = (dueDate.getTime() - now.getTime()) / (60 * 60 * 1000);
        const { data: assignments, error: assignmentError } = await supabaseClient_1.supabase
            .from('job_assignments')
            .select('user_id, users!inner(id, email)')
            .eq('job_id', job.id)
            .eq('organization_id', job.organization_id);
        if (assignmentError) {
            console.error('[DeadlineReminderWorker] Failed to load assignments for job', job.id, assignmentError);
            continue;
        }
        for (const assignment of assignments || []) {
            const user = assignment.users;
            const userData = Array.isArray(user) ? user[0] : user;
            if (!userData?.email)
                continue;
            const prefs = await (0, notifications_1.getNotificationPreferences)(assignment.user_id);
            if (!prefs.email_enabled || !prefs.email_deadline_reminder)
                continue;
            await (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.deadline_reminder, userData.email, {
                job: {
                    id: job.id,
                    title: job.client_name,
                    client_name: job.client_name,
                    due_date: job.due_date,
                },
                hoursRemaining,
            }, assignment.user_id);
        }
    }
    await supabaseClient_1.supabase.from('worker_period_runs').upsert({ worker_key: DEADLINE_REMINDER_WORKER_KEY, period_key: periodKey, ran_at: now.toISOString() }, { onConflict: 'worker_key,period_key' });
    console.log('[DeadlineReminderWorker] Queued daily deadline reminder emails');
}
function startDeadlineReminderWorker() {
    if (workerStarted) {
        console.log('[DeadlineReminderWorker] Already running');
        return;
    }
    workerStarted = true;
    console.log('[DeadlineReminderWorker] Starting...');
    workerTimer = setInterval(() => {
        runDeadlineReminderCycle().catch((error) => {
            console.error('[DeadlineReminderWorker] Cycle failed:', error);
        });
    }, 60 * 1000);
}
function stopDeadlineReminderWorker() {
    if (workerTimer) {
        clearInterval(workerTimer);
        workerTimer = null;
    }
    workerStarted = false;
}
//# sourceMappingURL=deadlineReminders.js.map