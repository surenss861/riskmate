import type { JobData, RiskScoreData, MitigationItem, OrganizationData, JobDocumentAsset, AuditLogEntry } from './types';
export declare function generateRiskSnapshotPDF(job: JobData, riskScore: RiskScoreData | null, mitigationItems: MitigationItem[], organization: OrganizationData, photos?: JobDocumentAsset[], auditLogs?: AuditLogEntry[]): Promise<Buffer>;
export type { JobData, RiskScoreData, MitigationItem, OrganizationData, JobDocumentAsset, AuditLogEntry, };
//# sourceMappingURL=index.d.ts.map