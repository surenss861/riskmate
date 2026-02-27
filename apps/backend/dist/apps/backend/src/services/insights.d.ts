/**
 * Predictive insights service: generates insight objects for an organization
 * based on jobs, compliance, risk, and team activity. Used by GET /api/analytics/insights.
 * Spec: deadline_risk, risk_pattern, pending_signatures, team_productivity, overdue_tasks.
 */
/** Spec-compliant type strings returned by /api/analytics/insights. */
export type InsightType = "deadline_risk" | "risk_pattern" | "pending_signatures" | "team_productivity" | "overdue_tasks";
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
    /** Actionable URL for the frontend (e.g. /jobs?status=open, /analytics/risk-heatmap). */
    action_url: string;
    /** Optional payload for the action (e.g. job_ids, count, filters). */
    data: Record<string, unknown>;
}
export type GenerateInsightsOptions = {
    since?: string;
    until?: string;
};
/**
 * Generate all candidate insights for an organization; caller may take top N.
 * Returns spec-compliant types: deadline_risk, risk_pattern, pending_signatures, team_productivity, overdue_tasks.
 * When options.since/until are provided, insights are scoped to that window; otherwise uses PERIOD_DAYS.
 */
export declare function generateInsights(orgId: string, options?: GenerateInsightsOptions): Promise<Insight[]>;
//# sourceMappingURL=insights.d.ts.map