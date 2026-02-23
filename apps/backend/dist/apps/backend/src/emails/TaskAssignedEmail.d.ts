export interface TaskAssignedEmailInput {
    userName: string;
    taskTitle: string;
    jobTitle: string;
    jobId: string;
    taskId: string;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function TaskAssignedEmail(input: TaskAssignedEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=TaskAssignedEmail.d.ts.map