/**
 * Predictive insights service: generates insight objects for an organization
 * based on jobs, compliance, risk, and team activity. Used by GET /api/analytics/insights.
 */
export type InsightType = "compliance_drop" | "risk_spike" | "hazard_trend" | "team_performance" | "completion_trend" | "high_risk_concentration" | "evidence_gap";
export type InsightSeverity = "info" | "warning" | "critical";
export interface Insight {
    id: string;
    type: InsightType;
    title: string;
    description: string;
    severity: InsightSeverity;
    metric_value?: number;
    metric_label?: string;
    period_days: number;
    created_at: string;
}
/**
 * Generate all candidate insights for an organization; caller may take top N.
 */
export declare function generateInsights(orgId: string): Promise<Insight[]>;
//# sourceMappingURL=insights.d.ts.map