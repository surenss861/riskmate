export interface JobAssignedEmailInput {
    userName: string;
    assignedByName: string;
    job: {
        id?: string;
        title?: string | null;
        client_name?: string | null;
        location?: string | null;
        due_date?: string | null;
        risk_level?: string | null;
    };
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function JobAssignedEmail(input: JobAssignedEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=JobAssignedEmail.d.ts.map