import type { OrganizationData, AuditLogEntry } from './types';
export declare function addWatermark(doc: PDFKit.PDFDocument): void;
export declare function addSectionHeader(doc: PDFKit.PDFDocument, title: string, prefix?: string): void;
export declare function groupTimelineEvents(auditLogs: AuditLogEntry[]): Array<{
    time: string;
    timeEnd?: string;
    description: string;
    actorName: string;
    count?: number;
}>;
export declare function addFooterInline(doc: PDFKit.PDFDocument, organization: OrganizationData, jobId: string, reportGeneratedAt: Date, pageNumber: number, totalPages: number): void;
//# sourceMappingURL=helpers.d.ts.map