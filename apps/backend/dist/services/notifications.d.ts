type DeviceTokenPayload = {
    userId: string;
    organizationId: string;
    token: string;
    platform?: string;
};
export declare function registerDeviceToken({ userId, organizationId, token, platform, }: DeviceTokenPayload): Promise<void>;
export declare function unregisterDeviceToken(token: string): Promise<void>;
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
export {};
//# sourceMappingURL=notifications.d.ts.map