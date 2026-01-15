export interface OrganizationBranding {
    id: string;
    name: string;
    logo_url?: string | null;
    accent_color?: string | null;
    subscription_tier?: string | null;
}
export interface JobReportPayload {
    job: any;
    risk_score: any | null;
    risk_factors: any[];
    mitigations: any[];
    documents: any[];
    audit: any[];
    organization: OrganizationBranding | null;
}
export declare function buildJobReport(organizationId: string, jobId: string): Promise<JobReportPayload>;
//# sourceMappingURL=jobReport.d.ts.map