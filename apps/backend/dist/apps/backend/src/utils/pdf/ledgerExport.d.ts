interface AuditLogEntry {
    id: string;
    event_name: string;
    created_at: string;
    category?: string;
    outcome?: string;
    severity?: string;
    actor_name?: string;
    actor_role?: string;
    job_id?: string;
    job_title?: string;
    target_type?: string;
    summary?: string;
}
interface LedgerExportOptions {
    organizationName: string;
    generatedBy: string;
    generatedByRole: string;
    exportId: string;
    timeRange: string;
    filters?: {
        time_range?: string | null;
        category?: string | null;
        site_id?: string | null;
        job_id?: string | null;
        actor_id?: string | null;
        severity?: string | null;
        outcome?: string | null;
    };
    events: AuditLogEntry[];
}
export declare function generateLedgerExportPDF(options: LedgerExportOptions): Promise<Buffer>;
export {};
//# sourceMappingURL=ledgerExport.d.ts.map