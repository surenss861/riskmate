export type AuditTargetType = "job" | "mitigation" | "document" | "report" | "subscription" | "legal" | "system";
export interface AuditLogEntry {
    organizationId: string;
    actorId?: string | null;
    eventName: string;
    targetType: AuditTargetType;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
}
export declare function recordAuditLog(entry: AuditLogEntry): Promise<void>;
//# sourceMappingURL=audit.d.ts.map