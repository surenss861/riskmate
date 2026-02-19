import { type EmailTemplate } from "./base";
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
}
export declare function WeeklyDigestEmail(input: WeeklyDigestEmailInput): EmailTemplate;
//# sourceMappingURL=WeeklyDigestEmail.d.ts.map