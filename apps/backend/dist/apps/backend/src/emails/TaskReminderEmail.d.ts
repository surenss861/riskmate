export interface TaskReminderEmailInput {
    userName: string;
    taskTitle: string;
    jobTitle: string;
    dueDate: string | null;
    isOverdue: boolean;
    hoursRemaining?: number;
    jobId?: string;
    taskId?: string;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function TaskReminderEmail(input: TaskReminderEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=TaskReminderEmail.d.ts.map