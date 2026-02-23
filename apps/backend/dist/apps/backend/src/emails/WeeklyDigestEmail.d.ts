export interface WeeklyDigestData {
    activeJobs: number;
    completedJobs: number;
    overdueJobs: number;
    needsAttention: Array<{
        title: string;
        status: "overdue" | "due_soon";
    }>;
    completedThisWeek: Array<{
        title: string;
        completedAt: string;
    }>;
}
export interface WeeklyDigestEmailInput {
    userName: string;
    digest: WeeklyDigestData;
    managePreferencesUrl?: string;
}
export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}
export declare function WeeklyDigestEmail(input: WeeklyDigestEmailInput): Promise<EmailTemplate>;
//# sourceMappingURL=WeeklyDigestEmail.d.ts.map