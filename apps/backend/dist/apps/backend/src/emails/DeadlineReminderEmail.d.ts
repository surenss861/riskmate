export interface DeadlineReminderEmailInput {
    userName: string;
    job: {
        id?: string;
        title?: string | null;
        client_name?: string | null;
        due_date?: string | null;
    };
    hoursRemaining: number;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function DeadlineReminderEmail(input: DeadlineReminderEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=DeadlineReminderEmail.d.ts.map