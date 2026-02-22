"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTaskReminderWorker = startTaskReminderWorker;
exports.stopTaskReminderWorker = stopTaskReminderWorker;
const supabaseClient_1 = require("../lib/supabaseClient");
const notifications_1 = require("../services/notifications");
const emailQueue_1 = require("./emailQueue");
const TASK_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_REMINDER_GAP_MS = 23 * 60 * 60 * 1000; // throttle: don't re-notify same task within ~23h
let workerRunning = false;
let workerInterval = null;
let startupTimeout = null;
function getMillisecondsUntilNext8amLocal() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(8, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
    }
    return Math.max(next.getTime() - now.getTime(), 0);
}
/** Send push and enqueue email for one task reminder; then update last_reminded_at to prevent duplicates. */
async function sendTaskReminderPushAndEmail(task, jobTitle, assigneeEmail, now, isOverdue) {
    const hoursRemaining = task.due_date
        ? (new Date(task.due_date).getTime() - now.getTime()) / (60 * 60 * 1000)
        : 0;
    if (isOverdue) {
        await (0, notifications_1.sendTaskOverdueNotification)(task.assigned_to, task.organization_id, task.id, task.title, jobTitle);
    }
    else {
        await (0, notifications_1.sendTaskDueSoonNotification)(task.assigned_to, task.organization_id, task.id, task.title, jobTitle, hoursRemaining);
    }
    if (assigneeEmail) {
        (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.task_reminder, assigneeEmail, {
            taskTitle: task.title,
            jobTitle,
            dueDate: task.due_date,
            isOverdue,
            hoursRemaining: isOverdue ? undefined : hoursRemaining,
            jobId: task.job_id,
            taskId: task.id,
        }, task.assigned_to);
    }
    await supabaseClient_1.supabase
        .from("tasks")
        .update({ last_reminded_at: new Date().toISOString() })
        .eq("id", task.id);
}
async function processTaskReminders() {
    const now = new Date();
    const remindedBefore = new Date(now.getTime() - MIN_REMINDER_GAP_MS).toISOString();
    const nowIso = now.toISOString();
    const in24hIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    try {
        // Due soon: due_date in [now, now+24h]. Overdue: all tasks with due_date < now (no cap).
        // last_reminded_at throttle prevents repeated sends within ~23h for all reminders.
        const { data: tasks, error } = await supabaseClient_1.supabase
            .from("tasks")
            .select("id, organization_id, assigned_to, title, job_id, due_date, status, last_reminded_at, job:job_id(client_name), assignee:assigned_to(email)")
            .lte("due_date", in24hIso)
            .neq("status", "done")
            .neq("status", "cancelled")
            .not("assigned_to", "is", null)
            .not("due_date", "is", null)
            .or(`last_reminded_at.is.null,last_reminded_at.lt.${remindedBefore}`);
        if (error) {
            console.error("[TaskReminderWorker] Failed to load tasks:", error);
            return;
        }
        const pending = tasks || [];
        console.log(`[TaskReminderWorker] Processing ${pending.length} task reminders`);
        let processed = 0;
        let failed = 0;
        for (const task of pending) {
            try {
                const jobTitle = task.job?.client_name ?? "Job";
                const assigneeEmail = task.assignee?.email ?? null;
                if (!assigneeEmail) {
                    console.warn("[TaskReminderWorker] No email for assignee", task.assigned_to, "skipping email");
                }
                const prefs = await (0, notifications_1.getNotificationPreferences)(task.assigned_to);
                const shouldQueueEmail = assigneeEmail &&
                    prefs.email_enabled &&
                    prefs.email_deadline_reminder;
                const isOverdue = task.due_date ? new Date(task.due_date).getTime() < now.getTime() : false;
                await sendTaskReminderPushAndEmail(task, jobTitle, shouldQueueEmail ? assigneeEmail : null, now, isOverdue);
                processed += 1;
            }
            catch (err) {
                failed += 1;
                console.error("[TaskReminderWorker] Failed to process task reminder:", {
                    taskId: task.id,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        console.log(`[TaskReminderWorker] Complete. processed=${processed} failed=${failed}`);
    }
    catch (err) {
        console.error("[TaskReminderWorker] Unexpected worker error:", err);
    }
}
function startTaskReminderWorker() {
    if (workerRunning) {
        console.log("[TaskReminderWorker] Already running");
        return;
    }
    workerRunning = true;
    console.log("[TaskReminderWorker] Starting...");
    const initialDelay = getMillisecondsUntilNext8amLocal();
    console.log(`[TaskReminderWorker] First run in ${Math.round(initialDelay / 1000)}s`);
    startupTimeout = setTimeout(() => {
        void processTaskReminders();
        workerInterval = setInterval(() => {
            void processTaskReminders();
        }, TASK_REMINDER_INTERVAL_MS);
    }, initialDelay);
}
function stopTaskReminderWorker() {
    if (startupTimeout) {
        clearTimeout(startupTimeout);
        startupTimeout = null;
    }
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
    }
    workerRunning = false;
    console.log("[TaskReminderWorker] Stopped");
}
//# sourceMappingURL=taskReminders.js.map