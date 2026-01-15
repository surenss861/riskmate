interface ExecutiveBriefData {
    generated_at: string;
    time_range: string;
    summary: {
        exposure_level: 'low' | 'moderate' | 'high';
        confidence_statement: string;
        counts: {
            high_risk_jobs: number;
            open_incidents: number;
            violations: number;
            flagged: number;
            pending_attestations: number;
            signed_attestations: number;
            proof_packs: number;
        };
        deltas?: {
            high_risk_jobs: number;
            open_incidents: number;
            violations: number;
            flagged_jobs: number;
            pending_signoffs: number;
            signed_signoffs: number;
            proof_packs: number;
        };
        top_drivers?: {
            highRiskJobs?: Array<{
                label: string;
                count: number;
            }>;
            openIncidents?: Array<{
                label: string;
                count: number;
            }>;
            violations?: Array<{
                label: string;
                count: number;
            }>;
            flagged?: Array<{
                label: string;
                count: number;
            }>;
            pending?: Array<{
                label: string;
                count: number;
            }>;
        };
        integrity?: {
            status: 'verified' | 'error' | 'not_verified';
            last_verified_at?: string | null;
        };
        recommended_actions?: Array<{
            priority: number;
            action: string;
            reason: string;
        }>;
    };
}
export declare function generateExecutiveBriefPDF(brief: ExecutiveBriefData, organizationName: string, generatedBy: string): Promise<{
    buffer: Buffer;
    hash: string;
}>;
export {};
//# sourceMappingURL=executiveBrief.d.ts.map