/**
 * Server-side bulk jobs export: build CSV string and PDF buffer from job rows.
 * Used by the export worker for export_type 'bulk_jobs'.
 */
export interface JobRowForExport {
    id: string;
    job_name: string;
    client_name: string;
    status?: string | null;
    assigned_to_name?: string | null;
    assigned_to_email?: string | null;
    due_date?: string | null;
    created_at?: string | null;
}
export declare function buildCsvString(jobs: JobRowForExport[]): string;
export declare function buildPdfBuffer(jobs: JobRowForExport[]): Promise<Uint8Array>;
//# sourceMappingURL=bulkJobsExport.d.ts.map