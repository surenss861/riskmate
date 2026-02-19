"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTaskReminderWorker = startTaskReminderWorker;
exports.stopTaskReminderWorker = stopTaskReminderWorker;
const supabaseClient_1 = require("../lib/supabaseClient");
const notifications_1 = require("../services/notifications");
const TASK_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MIN_REMINDER_GAP_MS = 23 * 60 * 60 * 1000;
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
async function processTaskReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + TASK_REMINDER_INTERVAL_MS);
    const remindedBefore = new Date(now.getTime() - MIN_REMINDER_GAP_MS).toISOString();
    const nowIso = now.toISOString();
    const in24hIso = in24h.toISOString();
    try {
        const { data: tasks, error } = await supabaseClient_1.supabase
            .from("tasks")
            .select("id, organization_id, assigned_to, title, job_id, due_date, status, last_reminded_at")
            .gte("due_date", nowIso)
            .lte("due_date", in24hIso)
            .neq("status", "done")
            .neq("status", "cancelled")
            .not("assigned_to", "is", null)
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
                const { data: job } = await supabaseClient_1.supabase
                    .from("jobs")
                    .select("client_name")
                    .eq("id", task.job_id)
                    .eq("organization_id", task.organization_id)
                    .maybeSingle();
                const jobTitle = job?.client_name || "Job";
                await (0, notifications_1.sendTaskOverdueNotification)(task.assigned_to, task.organization_id, task.id, task.title, jobTitle);
                await supabaseClient_1.supabase
                    .from("tasks")
                    .update({ last_reminded_at: new Date().toISOString() })
                    .eq("id", task.id);
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