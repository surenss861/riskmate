export declare function startTaskReminderWorker(): void;
export declare function stopTaskReminderWorker(): void;
/**
 * Run reminder for a single task (used when UI creates/updates a task with due_date in alert window).
 * Validates task belongs to org, is not done/cancelled, has assignee and due_date, and due_date is within
 * alert window (past or next 24h). Respects last_reminded_at throttle.
 * Returns true if reminder was sent/scheduled, false if task not eligible.
 */
export declare function runReminderForTask(organizationId: string, taskId: string): Promise<{
    scheduled: boolean;
    message?: string;
}>;
//# sourceMappingURL=taskReminders.d.ts.map