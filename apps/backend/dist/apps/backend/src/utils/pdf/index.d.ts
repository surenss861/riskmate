import type { JobData, RiskScoreData, MitigationItem, OrganizationData, JobDocumentAsset, AuditLogEntry } from './types';
import { type PdfSignatureData } from './sections/signatures';
export declare function generateRiskSnapshotPDF(job: JobData, riskScore: RiskScoreData | null, mitigationItems: MitigationItem[], organization: OrganizationData, photos?: JobDocumentAsset[], auditLogs?: AuditLogEntry[], 
/** When provided (e.g. from report_signatures for a report run), actual signatures are rendered in the PDF */
signatures?: PdfSignatureData[], 
/** Report run ID to fetch signatures from report_signatures table */
reportRunId?: string): Promise<Buffer>;
export type { JobData, RiskScoreData, MitigationItem, OrganizationData, JobDocumentAsset, AuditLogEntry, };
//# sourceMappingURL=index.d.ts.map