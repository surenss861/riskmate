export type AuditTargetType = "job" | "mitigation" | "document" | "report" | "subscription" | "legal" | "system" | "site" | "user" | "signoff" | "organization" | "proof_pack" | "evidence" | "export";
export interface AuditLogEntry {
    organizationId: string;
    actorId?: string | null;
    eventName: string;
    targetType: AuditTargetType;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
    client?: string;
    appVersion?: string;
    deviceId?: string;
}
export type AuditWriteResult = {
    data: {
        id: string;
    } | null;
    error: {
        message: string;
    } | null;
};
/**
 * Extract client metadata from request (for audit logging)
 * Looks for client, app_version, device_id in headers or body
 */
export declare function extractClientMetadata(req?: any): {
    client?: string;
    appVersion?: string;
    deviceId?: string;
};
export declare function recordAuditLog(entry: AuditLogEntry): Promise<AuditWriteResult>;
//# sourceMappingURL=audit.d.ts.map