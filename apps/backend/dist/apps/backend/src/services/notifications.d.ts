/** Validate token format. Backend accepts Expo tokens or APNs tokens. */
export declare function validatePushToken(token: string): {
    valid: boolean;
    type: "expo" | "apns" | "invalid";
};
type DeviceTokenPayload = {
    userId: string;
    organizationId: string;
    token: string;
    platform?: string;
};
/** Returns true if upsert succeeded, false on Supabase failure. Throws on invalid token. */
export declare function registerDeviceToken({ userId, organizationId, token, platform, }: DeviceTokenPayload): Promise<boolean>;
export declare function unregisterDeviceToken(token: string, userId: string, organizationId: string): Promise<boolean>;
/** Default notification preferences (contract keys). Master toggles on; weekly_summary off per spec; others on. */
export type NotificationPreferences = {
    push_enabled: boolean;
    email_enabled: boolean;
    mention: boolean;
    reply: boolean;
    job_assigned: boolean;
    signature_requested: boolean;
    evidence_uploaded: boolean;
    hazard_added: boolean;
    deadline_approaching: boolean;
    email_deadline_reminder: boolean;
    weekly_summary: boolean;
    email_weekly_digest: boolean;
    high_risk_job: boolean;
    report_ready: boolean;
    job_comment: boolean;
    comment_resolved: boolean;
};
export declare const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences;
/** Safe opt-out when preferences cannot be loaded (e.g. Supabase error). All delivery disabled to avoid re-enabling push/email for opted-out users. */
export declare const OPT_OUT_SAFE_PREFERENCES: NotificationPreferences;
/** Fetch notification preferences for a user; returns defaults if no row exists. On Supabase error returns OPT_OUT_SAFE_PREFERENCES so delivery is skipped (fail closed). */
export declare function getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
/** Fetch push tokens for a single user in a given organization (for targeted notifications). */
export declare function fetchUserTokens(userId: string, organizationId: string): Promise<string[]>;
/** Get unread notification count for a user in an organization (for badge in push payloads). */
export declare function getUnreadNotificationCount(userId: string, organizationId: string): Promise<number>;
/** Create a notification record so unread count and badge stay in sync. Returns the new notification id for push payload (data.id). */
export declare function createNotificationRecord(userId: string, organizationId: string, type: string, content: string, deepLink?: string | null): Promise<string | null>;
/** List notifications for a user in an organization with pagination (newest first). Includes deepLink for navigation. */
export declare function listNotifications(userId: string, organizationId: string, options?: {
    limit?: number;
    offset?: number;
    since?: string;
}): Promise<{
    data: Array<{
        id: string;
        type: string;
        content: string;
        is_read: boolean;
        created_at: string;
        deepLink?: string | null;
    }>;
}>;
/** Set notifications read state: all for the user in the org, or by id(s). Updates is_read and updated_at. */
export declare function setNotificationsReadState(userId: string, organizationId: string, read: boolean, ids?: string[]): Promise<void>;
/** Mark notifications as read: all for the user in the org, or by id(s). Convenience wrapper. */
export declare function markNotificationsAsRead(userId: string, organizationId: string, ids?: string[]): Promise<void>;
export declare function notifyHighRiskJob(params: {
    organizationId: string;
    jobId: string;
    clientName: string;
    riskScore: number;
}): Promise<void>;
export declare function notifyReportReady(params: {
    organizationId: string;
    jobId: string;
    pdfUrl?: string | null;
}): Promise<void>;
export declare function notifyWeeklySummary(params: {
    organizationId: string;
    message: string;
}): Promise<void>;
/** Notify user when they are assigned to a job. */
export declare function sendJobAssignedNotification(userId: string, organizationId: string, jobId: string, jobTitle?: string): Promise<void>;
export declare function sendTaskAssignedNotification(userId: string, organizationId: string, taskId: string, jobTitle: string, taskTitle: string): Promise<void>;
export declare function sendTaskCompletedNotification(userId: string, organizationId: string, taskId: string, taskTitle: string, jobTitle: string, jobId?: string): Promise<void>;
export declare function sendTaskOverdueNotification(userId: string, organizationId: string, taskId: string, taskTitle: string, jobTitle: string): Promise<void>;
/** Notify assignee that a task is due within 24 hours (push only; caller should queue email separately). */
export declare function sendTaskDueSoonNotification(userId: string, organizationId: string, taskId: string, taskTitle: string, jobTitle: string, hoursRemaining: number): Promise<void>;
/** Notify user when their signature is requested on a report run. */
export declare function sendSignatureRequestNotification(userId: string, organizationId: string, reportRunId: string, jobTitle?: string): Promise<void>;
/** Notify user when evidence is uploaded to a job they care about. */
export declare function sendEvidenceUploadedNotification(userId: string, organizationId: string, jobId: string, photoId: string): Promise<void>;
/** Notify user when a hazard is added to a job. */
export declare function sendHazardAddedNotification(userId: string, organizationId: string, jobId: string, hazardId: string): Promise<void>;
/** Notify user about an approaching job deadline. */
export declare function sendDeadlineNotification(userId: string, organizationId: string, jobId: string, hoursRemaining: number, jobTitle?: string): Promise<void>;
/** Notify user when they are mentioned in a comment. */
export declare function sendMentionNotification(userId: string, organizationId: string, commentId: string, contextLabel?: string): Promise<void>;
/** Notify user when someone replies to their comment. */
export declare function sendCommentReplyNotification(userId: string, organizationId: string, commentId: string, contextLabel?: string): Promise<void>;
/** Notify job owner when someone comments on a job they own (skips when author is the owner). */
export declare function sendJobCommentNotification(userId: string, organizationId: string, commentId: string, jobId: string, contextLabel?: string): Promise<void>;
/** Notify comment author when someone else resolves their comment. */
export declare function sendCommentResolvedNotification(authorUserId: string, organizationId: string, commentId: string, contextLabel?: string): Promise<void>;
export {};
//# sourceMappingURL=notifications.d.ts.map