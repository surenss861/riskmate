export type AuditTargetType = "job" | "mitigation" | "document" | "report" | "subscription" | "legal" | "system" | "site" | "user" | "signoff" | "organization" | "proof_pack" | "evidence" | "export";
export interface AuditLogEntry {
    organizationId: string;
    actorId?: string | null;
    eventName: string;
    targetType: AuditTargetType;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
}
export type AuditWriteResult = {
    data: {
        id: string;
    } | null;
    error: {
        message: string;
    } | null;
};
export declare function recordAuditLog(entry: AuditLogEntry): Promise<AuditWriteResult>;
//# sourceMappingURL=audit.d.ts.map