"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTaskReminderWorker = startTaskReminderWorker;
exports.stopTaskReminderWorker = stopTaskReminderWorker;
exports.runReminderForTask = runReminderForTask;
const supabaseClient_1 = require("../lib/supabaseClient");
const workerLock_1 = require("../lib/workerLock");
const notifications_1 = require("../services/notifications");
const emailQueue_1 = require("./emailQueue");
const TASK_REMINDER_WORKER_KEY = "task_reminder";
const TASK_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_REMINDER_GAP_MS = 23 * 60 * 60 * 1000; // throttle: don't re-notify same task within ~23h
const ALERT_WINDOW_MS = 24 * 60 * 60 * 1000; // due soon: within 24h
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
/** Today as YYYY-MM-DD (local) for worker_period_runs. */
function getTodayPeriodKey() {
    const d = new Date();
    return (d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0"));
}
/** True if current time is past today's 8am (used for catch-up after downtime). */
function isPastToday8am() {
    const now = new Date();
    const today8am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
    return now.getTime() > today8am.getTime();
}
/** Send push and enqueue email for one task reminder. Returns true if at least one notification was sent (push or email); only then do we update last_reminded_at so opt-in users get reminders promptly. */
async function sendTaskReminderPushAndEmail(task, jobTitle, assigneeEmail, now, isOverdue) {
    const hoursRemaining = task.due_date
        ? (new Date(task.due_date).getTime() - now.getTime()) / (60 * 60 * 1000)
        : 0;
    const pushSent = isOverdue
        ? await (0, notifications_1.sendTaskOverdueNotification)(task.assigned_to, task.organization_id, task.id, task.title, jobTitle)
        : await (0, notifications_1.sendTaskDueSoonNotification)(task.assigned_to, task.organization_id, task.id, task.title, jobTitle, hoursRemaining);
    let emailQueued = false;
    if (assigneeEmail) {
        await (0, emailQueue_1.queueEmail)(emailQueue_1.EmailJobType.task_reminder, assigneeEmail, {
            taskTitle: task.title,
            jobTitle,
            dueDate: task.due_date,
            isOverdue,
            hoursRemaining: isOverdue ? undefined : hoursRemaining,
            jobId: task.job_id,
            taskId: task.id,
        }, task.assigned_to);
        emailQueued = true;
    }
    const sent = pushSent || emailQueued;
    if (sent) {
        await supabaseClient_1.supabase
            .from("tasks")
            .update({ last_reminded_at: new Date().toISOString() })
            .eq("id", task.id);
    }
    return sent;
}
async function processTaskReminders() {
    const hasLease = await (0, workerLock_1.tryAcquireWorkerLease)(workerLock_1.WORKER_LEASE_KEYS.task_reminder);
    if (!hasLease)
        return;
    const now = new Date();
    const remindedBefore = new Date(now.getTime() - MIN_REMINDER_GAP_MS).toISOString();
    const in24hIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const past24hIso = new Date(now.getTime() - ALERT_WINDOW_MS).toISOString();
    try {
        // Due soon: due_date in [now, now+24h]. Overdue: due_date in [now-24h, now). Cap at 24h overdue so we don't email indefinitely.
        // last_reminded_at throttle prevents repeated sends within ~23h for all reminders.
        // Do not use assignee:assigned_to(email) embed: tasks.assigned_to FKs auth.users; PostgREST has no public relationship. Fetch emails from users.
        const { data: tasks, error } = await supabaseClient_1.supabase
            .from("tasks")
            .select("id, organization_id, assigned_to, title, job_id, due_date, status, last_reminded_at, job:job_id(client_name)")
            .gte("due_date", past24hIso)
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
        const assigneeIds = [...new Set(pending.map((t) => t.assigned_to).filter(Boolean))];
        let assigneeEmailById = {};
        if (assigneeIds.length > 0) {
            const { data: users } = await supabaseClient_1.supabase.from("users").select("id, email").in("id", assigneeIds);
            if (users) {
                assigneeEmailById = Object.fromEntries(users.map((u) => [u.id, u.email ?? ""]));
            }
        }
        console.log(`[TaskReminderWorker] Processing ${pending.length} task reminders`);
        let processed = 0;
        let failed = 0;
        for (const task of pending) {
            try {
                const jobRow = task.job;
                const jobTitle = (Array.isArray(jobRow) ? jobRow[0] : jobRow)?.client_name ?? "Job";
                const assigneeEmail = task.assigned_to ? assigneeEmailById[task.assigned_to] ?? null : null;
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
        await supabaseClient_1.supabase.from("worker_period_runs").upsert({
            worker_key: TASK_REMINDER_WORKER_KEY,
            period_key: getTodayPeriodKey(),
            ran_at: new Date().toISOString(),
        }, { onConflict: "worker_key,period_key" });
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
    const scheduleFirstAndInterval = () => {
        void processTaskReminders();
        workerInterval = setInterval(() => {
            void processTaskReminders();
        }, TASK_REMINDER_INTERVAL_MS);
    };
    if (isPastToday8am()) {
        const periodKey = getTodayPeriodKey();
        void Promise.resolve(supabaseClient_1.supabase
            .from("worker_period_runs")
            .select("ran_at")
            .eq("worker_key", TASK_REMINDER_WORKER_KEY)
            .eq("period_key", periodKey)
            .maybeSingle())
            .then(({ data: existing }) => {
            if (existing) {
                console.log("[TaskReminderWorker] Already ran today; first run at next 8am");
            }
            else {
                console.log("[TaskReminderWorker] Catch-up run (8am window was missed)");
                void processTaskReminders().then(() => {
                    startupTimeout = setTimeout(scheduleFirstAndInterval, initialDelay);
                });
                return;
            }
            startupTimeout = setTimeout(scheduleFirstAndInterval, initialDelay);
        })
            .catch((err) => {
            console.error("[TaskReminderWorker] Failed to check period run:", err);
            startupTimeout = setTimeout(scheduleFirstAndInterval, initialDelay);
        });
    }
    else {
        console.log(`[TaskReminderWorker] First run in ${Math.round(initialDelay / 1000)}s`);
        startupTimeout = setTimeout(scheduleFirstAndInterval, initialDelay);
    }
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
/**
 * Run reminder for a single task (used when UI creates/updates a task with due_date in alert window).
 * Validates task belongs to org, is not done/cancelled, has assignee and due_date, and due_date is within
 * alert window (past or next 24h). Respects last_reminded_at throttle.
 * Returns true if reminder was sent/scheduled, false if task not eligible.
 */
async function runReminderForTask(organizationId, taskId) {
    const now = new Date();
    const remindedBefore = new Date(now.getTime() - MIN_REMINDER_GAP_MS).toISOString();
    const in24hIso = new Date(now.getTime() + ALERT_WINDOW_MS).toISOString();
    const { data: task, error } = await supabaseClient_1.supabase
        .from("tasks")
        .select("id, organization_id, assigned_to, title, job_id, due_date, status, last_reminded_at, job:job_id(client_name)")
        .eq("id", taskId)
        .eq("organization_id", organizationId)
        .maybeSingle();
    if (error || !task) {
        return { scheduled: false, message: "Task not found" };
    }
    if (task.status === "done" || task.status === "cancelled") {
        return { scheduled: false, message: "Task is completed or cancelled" };
    }
    if (!task.assigned_to || !task.due_date) {
        return { scheduled: false, message: "Task has no assignee or due date" };
    }
    if (task.due_date > in24hIso) {
        return { scheduled: false, message: "Due date is not within the next 24 hours" };
    }
    const past24hIso = new Date(now.getTime() - ALERT_WINDOW_MS).toISOString();
    if (task.due_date < past24hIso) {
        return { scheduled: false, message: "Due date is more than 24 hours overdue" };
    }
    if (task.last_reminded_at && task.last_reminded_at >= remindedBefore) {
        return { scheduled: true, message: "Reminder already sent recently" };
    }
    const jobRow = task.job;
    const jobTitle = (Array.isArray(jobRow) ? jobRow[0] : jobRow)?.client_name ?? "Job";
    let assigneeEmail = null;
    const { data: assigneeUser } = await supabaseClient_1.supabase.from("users").select("email").eq("id", task.assigned_to).maybeSingle();
    assigneeEmail = assigneeUser?.email ?? null;
    const prefs = await (0, notifications_1.getNotificationPreferences)(task.assigned_to);
    const shouldQueueEmail = assigneeEmail && prefs.email_enabled && prefs.email_deadline_reminder;
    const isOverdue = new Date(task.due_date).getTime() < now.getTime();
    await sendTaskReminderPushAndEmail(task, jobTitle, shouldQueueEmail ? assigneeEmail : null, now, isOverdue);
    return { scheduled: true };
}
//# sourceMappingURL=taskReminders.js.map