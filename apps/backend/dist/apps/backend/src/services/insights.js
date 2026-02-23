"use strict";
/**
 * Predictive insights service: generates insight objects for an organization
 * based on jobs, compliance, risk, and team activity. Used by GET /api/analytics/insights.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInsights = generateInsights;
const supabaseClient_1 = require("../lib/supabaseClient");
const PERIOD_DAYS = 30;
const MAX_JOBS = 10000;
function dateRange(days) {
    const until = new Date();
    until.setHours(23, 59, 59, 999);
    const since = new Date(until.getTime());
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);
    return { since: since.toISOString(), until: until.toISOString() };
}
/**
 * Generate all candidate insights for an organization; caller may take top N.
 */
async function generateInsights(orgId) {
    const insights = [];
    const { since, until } = dateRange(PERIOD_DAYS);
    const id = () => `insight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    try {
        const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, status, risk_score, risk_level, created_at")
            .eq("organization_id", orgId)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_JOBS);
        if (jobsError)
            return insights;
        const jobList = jobs || [];
        const total = jobList.length;
        const completed = jobList.filter((j) => j.status?.toLowerCase() === "completed").length;
        const completionRate = total === 0 ? 0 : completed / total;
        const withRisk = jobList.filter((j) => j.risk_score != null);
        const avgRisk = withRisk.length === 0 ? 0 : withRisk.reduce((a, j) => a + (j.risk_score ?? 0), 0) / withRisk.length;
        const highRiskCount = jobList.filter((j) => (j.risk_score ?? 0) >= 70).length;
        const basePath = "/dashboard";
        const jobsPath = `${basePath}/jobs`;
        const analyticsPath = `${basePath}/analytics`;
        // completion_trend
        if (total > 0) {
            insights.push({
                id: id(),
                type: "completion_trend",
                title: "Job completion this period",
                description: `${completed} of ${total} jobs completed (${Math.round(completionRate * 100)}%).`,
                severity: completionRate >= 0.8 ? "info" : completionRate >= 0.5 ? "warning" : "critical",
                metric_value: Math.round(completionRate * 10000) / 100,
                metric_label: "Completion %",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${jobsPath}?status=open`,
                data: { total, completed, completion_rate: completionRate },
            });
        }
        // risk_spike / high_risk_concentration
        const highRiskJobIds = jobList.filter((j) => (j.risk_score ?? 0) >= 70).map((j) => j.id);
        if (highRiskCount > 0) {
            const pct = total === 0 ? 0 : highRiskCount / total;
            insights.push({
                id: id(),
                type: "high_risk_concentration",
                title: "High-risk jobs",
                description: `${highRiskCount} job(s) with risk score ≥ 70 in the last ${PERIOD_DAYS} days.`,
                severity: pct > 0.2 ? "critical" : pct > 0.1 ? "warning" : "info",
                metric_value: highRiskCount,
                metric_label: "High-risk count",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${analyticsPath}/risk-heatmap`,
                data: { high_risk_count: highRiskCount, job_ids: highRiskJobIds.slice(0, 50) },
            });
        }
        if (avgRisk > 0) {
            insights.push({
                id: id(),
                type: "risk_spike",
                title: "Average risk score",
                description: `Average risk score is ${Math.round(avgRisk)} (${withRisk.length} jobs scored).`,
                severity: avgRisk >= 70 ? "critical" : avgRisk >= 50 ? "warning" : "info",
                metric_value: Math.round(avgRisk * 100) / 100,
                metric_label: "Avg risk",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${analyticsPath}/risk-heatmap`,
                data: { avg_risk: avgRisk, jobs_scored: withRisk.length },
            });
        }
        // compliance_drop (low completion rate)
        if (total > 0 && completionRate < 0.7) {
            insights.push({
                id: id(),
                type: "compliance_drop",
                title: "Compliance below target",
                description: `Completion rate is ${Math.round(completionRate * 100)}%. Consider prioritizing open jobs.`,
                severity: completionRate < 0.4 ? "critical" : "warning",
                metric_value: Math.round(completionRate * 10000) / 100,
                metric_label: "Completion %",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${jobsPath}?status=in_progress`,
                data: { total, completed, completion_rate: completionRate },
            });
        }
        // team_performance: top completions from mitigation_items
        const { data: mitigations } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .select("completed_by")
            .eq("organization_id", orgId)
            .not("completed_at", "is", null)
            .gte("completed_at", since)
            .lte("completed_at", until)
            .limit(MAX_JOBS);
        const byUser = {};
        (mitigations || []).forEach((m) => {
            const uid = m.completed_by ?? "unknown";
            if (uid !== "unknown")
                byUser[uid] = (byUser[uid] ?? 0) + 1;
        });
        const topUser = Object.entries(byUser).sort((a, b) => b[1] - a[1])[0];
        if (topUser) {
            insights.push({
                id: id(),
                type: "team_performance",
                title: "Top contributor",
                description: `Leading ${topUser[1]} mitigation completions in the last ${PERIOD_DAYS} days.`,
                severity: "info",
                metric_value: topUser[1],
                metric_label: "Completions",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${analyticsPath}/team-performance`,
                data: { user_id: topUser[0], completions: topUser[1] },
            });
        }
        // hazard_trend: most frequent hazard/control
        const { data: items } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .select("title, factor_id")
            .eq("organization_id", orgId)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_JOBS);
        const hazardCounts = {};
        (items || []).forEach((m) => {
            const key = (m.title || m.factor_id || "unknown");
            hazardCounts[key] = (hazardCounts[key] ?? 0) + 1;
        });
        const topHazard = Object.entries(hazardCounts).sort((a, b) => b[1] - a[1])[0];
        if (topHazard && topHazard[1] >= 3) {
            insights.push({
                id: id(),
                type: "hazard_trend",
                title: "Frequent hazard",
                description: `"${topHazard[0].slice(0, 40)}${topHazard[0].length > 40 ? "…" : ""}" appears ${topHazard[1]} times.`,
                severity: "info",
                metric_value: topHazard[1],
                metric_label: "Occurrences",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${analyticsPath}/hazard-frequency`,
                data: { hazard_label: topHazard[0], count: topHazard[1] },
            });
        }
        // evidence_gap: jobs without documents (optional, if we have job ids)
        const jobIds = jobList.map((j) => j.id);
        if (jobIds.length > 0) {
            const { data: docs } = await supabaseClient_1.supabase
                .from("documents")
                .select("job_id")
                .in("job_id", jobIds.slice(0, 5000))
                .limit(10000);
            const withDoc = new Set((docs || []).map((d) => d.job_id));
            const sampleSize = jobIds.length;
            const withoutDoc = jobIds.filter((id) => !withDoc.has(id)).length;
            if (withoutDoc > 0 && sampleSize >= 5) {
                const pct = withoutDoc / sampleSize;
                const jobIdsWithoutDoc = jobIds.filter((jid) => !withDoc.has(jid)).slice(0, 50);
                insights.push({
                    id: id(),
                    type: "evidence_gap",
                    title: "Jobs without evidence",
                    description: `${withoutDoc} of ${sampleSize} jobs have no documents in this period.`,
                    severity: pct > 0.5 ? "warning" : "info",
                    metric_value: Math.round((withoutDoc / sampleSize) * 10000) / 100,
                    metric_label: "% without evidence",
                    period_days: PERIOD_DAYS,
                    created_at: new Date().toISOString(),
                    action_url: `${jobsPath}?has_evidence=false`,
                    data: { jobs_without_evidence: withoutDoc, total_jobs: sampleSize, job_ids: jobIdsWithoutDoc },
                });
            }
        }
        // Sort by severity weight then by metric relevance
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || (b.metric_value ?? 0) - (a.metric_value ?? 0));
    }
    catch (e) {
        console.error("generateInsights error:", e);
    }
    return insights;
}
//# sourceMappingURL=insights.js.map