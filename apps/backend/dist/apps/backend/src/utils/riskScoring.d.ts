/**
 * Risk Scoring Engine
 * Deterministic scoring based on risk factor severity weights
 */
export interface RiskFactor {
    id: string;
    code: string;
    name: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    mitigation_steps: string[];
}
export interface RiskScoreResult {
    overall_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    factors: Array<{
        code: string;
        name: string;
        severity: string;
        weight: number;
    }>;
}
/**
 * Calculate risk score from selected risk factor codes
 */
export declare function calculateRiskScore(riskFactorCodes: string[]): Promise<RiskScoreResult>;
export interface InsertedMitigationItem {
    id: string;
    title: string | null;
    description: string | null;
    created_at: string;
    updated_at: string | null;
    hazard_id: string | null;
}
/**
 * Generate mitigation items from triggered risk factors.
 * Returns inserted rows so callers can emit hazard.created webhooks.
 */
export declare function generateMitigationItems(jobId: string, riskFactorCodes: string[]): Promise<InsertedMitigationItem[]>;
//# sourceMappingURL=riskScoring.d.ts.map