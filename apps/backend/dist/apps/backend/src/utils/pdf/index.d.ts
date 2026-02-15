import type { JobData, RiskScoreData, MitigationItem, OrganizationData, JobDocumentAsset, AuditLogEntry } from './types';
export declare function generateRiskSnapshotPDF(job: JobData, riskScore: RiskScoreData | null, mitigationItems: MitigationItem[], organization: OrganizationData, photos?: JobDocumentAsset[], auditLogs?: AuditLogEntry[], 
/** Report run ID to fetch signatures from report_signatures (revoked_at IS NULL, order by signed_at) */
reportRunId?: string): Promise<Buffer>;
export type { JobData, RiskScoreData, MitigationItem, OrganizationData, JobDocumentAsset, AuditLogEntry, };
//# sourceMappingURL=index.d.ts.map