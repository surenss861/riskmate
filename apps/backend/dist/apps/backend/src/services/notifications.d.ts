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
export declare function registerDeviceToken({ userId, organizationId, token, platform, }: DeviceTokenPayload): Promise<void>;
export declare function unregisterDeviceToken(token: string): Promise<void>;
/** Default notification preferences (all enabled). */
export declare const DEFAULT_NOTIFICATION_PREFERENCES: {
    readonly mentions_enabled: true;
    readonly job_assigned_enabled: true;
    readonly signature_request_enabled: true;
    readonly evidence_uploaded_enabled: true;
    readonly hazard_added_enabled: true;
    readonly deadline_enabled: true;
    readonly weekly_summary_enabled: true;
    readonly high_risk_job_enabled: true;
    readonly report_ready_enabled: true;
};
export type NotificationPreferences = typeof DEFAULT_NOTIFICATION_PREFERENCES;
/** Fetch notification preferences for a user; returns defaults if no row exists. */
export declare function getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
/** Fetch push tokens for a single user (for targeted notifications). */
export declare function fetchUserTokens(userId: string): Promise<string[]>;
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
export declare function sendJobAssignedNotification(userId: string, jobId: string, jobTitle?: string): Promise<void>;
/** Notify user when their signature is requested on a report run. */
export declare function sendSignatureRequestNotification(userId: string, reportRunId: string, jobTitle?: string): Promise<void>;
/** Notify user when evidence is uploaded to a job they care about. */
export declare function sendEvidenceUploadedNotification(userId: string, jobId: string, photoId: string): Promise<void>;
/** Notify user when a hazard is added to a job. */
export declare function sendHazardAddedNotification(userId: string, jobId: string, hazardId: string): Promise<void>;
/** Notify user about an approaching job deadline. */
export declare function sendDeadlineNotification(userId: string, jobId: string, hoursRemaining: number, jobTitle?: string): Promise<void>;
/** Notify user when they are mentioned in a comment. */
export declare function sendMentionNotification(userId: string, commentId: string, contextLabel?: string): Promise<void>;
export {};
//# sourceMappingURL=notifications.d.ts.map