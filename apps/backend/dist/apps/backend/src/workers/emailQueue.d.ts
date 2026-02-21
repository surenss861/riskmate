export declare enum EmailJobType {
    job_assigned = "job_assigned",
    signature_request = "signature_request",
    report_ready = "report_ready",
    welcome = "welcome",
    team_invite = "team_invite",
    mention = "mention",
    weekly_digest = "weekly_digest",
    deadline_reminder = "deadline_reminder",
    task_reminder = "task_reminder",
    task_assigned = "task_assigned",
    task_completed = "task_completed"
}
export interface EmailJob {
    id: string;
    type: EmailJobType;
    to: string;
    userId?: string;
    data: Record<string, unknown>;
    scheduledAt?: Date;
    attempts: number;
    createdAt: Date;
}
export declare function queueEmail(type: EmailJobType, to: string, data: Record<string, unknown>, userId?: string, scheduledAt?: Date): EmailJob;
export declare function startEmailQueueWorker(): void;
export declare function stopEmailQueueWorker(): void;
//# sourceMappingURL=emailQueue.d.ts.map