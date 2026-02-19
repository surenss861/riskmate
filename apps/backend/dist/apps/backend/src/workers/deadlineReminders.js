"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDeadlineReminderWorker = startDeadlineReminderWorker;
exports.stopDeadlineReminderWorker = stopDeadlineReminderWorker;
const supabaseClient_1 = require("../lib/supabaseClient");
const emailQueue_1 = require("./emailQueue");
let workerStarted = false;
let workerTimer = null;
let lastRunDateKey = null;
async function runDeadlineReminderCycle() {
    const now = new Date();
    const inWindow = now.getHours() === 8 && now.getMinutes() <= 1;
    if (!inWindow)
        return;
    const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (dateKey === lastRunDateKey)
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
            (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.deadline_reminder, userData.email, {
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
    lastRunDateKey = dateKey;
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