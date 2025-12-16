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
/**
 * Generate mitigation items from triggered risk factors
 */
export declare function generateMitigationItems(jobId: string, riskFactorCodes: string[]): Promise<void>;
//# sourceMappingURL=riskScoring.d.ts.map