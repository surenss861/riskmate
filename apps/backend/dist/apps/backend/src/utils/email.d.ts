import { type WeeklyDigestData } from '../emails/WeeklyDigestEmail';
interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}
export declare function sendEmail(options: EmailOptions): Promise<void>;
export declare function sendJobAssignedEmail(to: string, userName: string, job: {
    id?: string;
    title?: string | null;
    client_name?: string | null;
    location?: string | null;
    due_date?: string | null;
    risk_level?: string | null;
}, assignedByName: string, userId: string): Promise<void>;
export declare function sendSignatureRequestEmail(to: string, userName: string, reportName: string, jobTitle: string, reportRunId: string, deadline: string | undefined, userId: string): Promise<void>;
export declare function sendReportReadyEmail(to: string, userName: string, jobTitle: string, downloadUrl: string, viewUrl: string, userId: string): Promise<void>;
export declare function sendWelcomeEmail(to: string, userName: string, _userId?: string): Promise<void>;
export declare function sendTeamInviteEmail(to: string, orgName: string, inviterName: string, tempPassword: string, loginUrl: string, _userId?: string): Promise<void>;
export declare function sendMentionEmail(to: string, userName: string, mentionedByName: string, jobName: string, commentPreview: string, commentUrl: string, userId: string): Promise<void>;
export declare function sendWeeklyDigestEmail(to: string, userName: string, digest: WeeklyDigestData, userId: string): Promise<void>;
export declare function sendDeadlineReminderEmail(to: string, userName: string, job: {
    id?: string;
    title?: string | null;
    client_name?: string | null;
    due_date?: string | null;
}, hoursRemaining: number, userId: string): Promise<void>;
export declare function sendTaskAssignedEmail(to: string, userName: string, params: {
    taskTitle: string;
    jobTitle: string;
    jobId: string;
    taskId: string;
}, userId: string): Promise<void>;
export declare function sendTaskCompletedEmail(to: string, userName: string, params: {
    taskTitle: string;
    jobTitle: string;
    taskId: string;
}, userId: string): Promise<void>;
export declare function sendTaskReminderEmail(to: string, userName: string, params: {
    taskTitle: string;
    jobTitle: string;
    dueDate: string | null;
    isOverdue: boolean;
    hoursRemaining?: number;
    jobId?: string;
    taskId?: string;
}, userId: string): Promise<void>;
export declare function hashAlertPayload(payload: Record<string, unknown>): string;
export {};
//# sourceMappingURL=email.d.ts.map