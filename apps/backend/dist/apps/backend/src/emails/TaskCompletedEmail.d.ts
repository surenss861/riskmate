export interface TaskCompletedEmailInput {
    userName: string;
    taskTitle: string;
    jobTitle: string;
    taskId: string;
    jobId: string;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function TaskCompletedEmail(input: TaskCompletedEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=TaskCompletedEmail.d.ts.map