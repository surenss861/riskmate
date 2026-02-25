"use strict";
/**
 * Predictive insights service: generates insight objects for an organization
 * based on jobs, compliance, risk, and team activity. Used by GET /api/analytics/insights.
 * Spec: deadline_risk, risk_pattern, pending_signatures, team_productivity, overdue_tasks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInsights = generateInsights;
const supabaseClient_1 = require("../lib/supabaseClient");
const PERIOD_DAYS = 30;
const MAX_JOBS = 10000;
const DEADLINE_RISK_DAYS = 2;
/** Window for due-soon / pending-signature insights (days from now). */
const DUE_WINDOW_DAYS = 7;
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
 * Returns spec-compliant types: deadline_risk, risk_pattern, pending_signatures, team_productivity, overdue_tasks.
 */
async function generateInsights(orgId) {
    const insights = [];
    const { since, until } = dateRange(PERIOD_DAYS);
    const id = () => `insight-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const basePath = "/dashboard";
    const jobsPath = `${basePath}/jobs`;
    const analyticsPath = `${basePath}/analytics`;
    try {
        const now = new Date();
        const nowIso = now.toISOString();
        const twoDaysFromNow = new Date(now.getTime() + DEADLINE_RISK_DAYS * 24 * 60 * 60 * 1000);
        const sevenDaysFromNow = new Date(now.getTime() + DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
        // Full counts and limited payload via RPC (no cap; metrics reflect full set)
        const { data: dueCountsRows, error: dueCountsError } = await supabaseClient_1.supabase.rpc("get_insights_due_counts", {
            p_org_id: orgId,
            p_now: nowIso,
            p_two_days_later: twoDaysFromNow.toISOString(),
            p_seven_days_later: sevenDaysFromNow.toISOString(),
        });
        if (dueCountsError)
            return insights;
        const dueCounts = Array.isArray(dueCountsRows) ? dueCountsRows[0] : dueCountsRows;
        if (!dueCounts)
            return insights;
        const deadlineRiskCount = Number(dueCounts.deadline_risk_count ?? 0);
        const deadlineRiskJobIds = (dueCounts.deadline_risk_job_ids ?? []);
        // --- 1. Deadline risk: open jobs <50% complete with <2 days to due (full count from RPC) ---
        if (deadlineRiskCount > 0) {
            insights.push({
                id: id(),
                type: "deadline_risk",
                title: "Deadline risk",
                description: `${deadlineRiskCount} job(s) are less than 50% complete with under ${DEADLINE_RISK_DAYS} days to due date.`,
                severity: deadlineRiskCount > 5 ? "critical" : deadlineRiskCount > 2 ? "warning" : "info",
                metric_value: deadlineRiskCount,
                metric_label: "Jobs at risk",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${jobsPath}?due_soon=true`,
                data: { job_ids: deadlineRiskJobIds.slice(0, 50), count: deadlineRiskCount },
            });
        }
        // --- 2. Recurring high-risk patterns by job_type and day-of-week (use jobs created in period) ---
        const { data: periodJobs, error: periodJobsError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, status, risk_score, risk_level, created_at, due_date, job_type")
            .eq("organization_id", orgId)
            .is("deleted_at", null)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_JOBS);
        const periodJobList = (periodJobsError ? [] : (periodJobs || []));
        const highRiskJobs = periodJobList.filter((j) => (j.risk_score ?? 0) >= 70);
        const bucketCount = {};
        highRiskJobs.forEach((j) => {
            const jobType = j.job_type ?? "other";
            const dayOfWeek = new Date(j.created_at).getDay();
            const key = `${jobType}|${dayOfWeek}`;
            bucketCount[key] = (bucketCount[key] ?? 0) + 1;
        });
        const recurringEntries = Object.entries(bucketCount).filter(([, count]) => count >= 2);
        if (recurringEntries.length > 0) {
            const top = recurringEntries.sort((a, b) => b[1] - a[1])[0];
            const [jobType, dayNum] = top[0].split("|");
            const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            insights.push({
                id: id(),
                type: "risk_pattern",
                title: "Recurring high-risk pattern",
                description: `High-risk jobs concentrate on ${dayNames[parseInt(dayNum, 10)]} for job type "${jobType}" (${top[1]} in period).`,
                severity: top[1] >= 5 ? "critical" : top[1] >= 3 ? "warning" : "info",
                metric_value: top[1],
                metric_label: "Occurrences",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${analyticsPath}/risk-heatmap`,
                data: { job_type: jobType, day_of_week: parseInt(dayNum, 10), count: top[1], patterns: recurringEntries.slice(0, 10).map(([k, v]) => ({ bucket: k, count: v })) },
            });
        }
        // --- 3. Pending signatures near compliance deadlines (full count from RPC) ---
        const pendingSignaturesCount = Number(dueCounts.pending_signatures_count ?? 0);
        const pendingSignaturesJobIds = (dueCounts.pending_signatures_job_ids ?? []);
        if (pendingSignaturesCount > 0) {
            insights.push({
                id: id(),
                type: "pending_signatures",
                title: "Pending signatures near deadline",
                description: `${pendingSignaturesCount} job(s) have no signature and are within 7 days of compliance deadline.`,
                severity: pendingSignaturesCount > 3 ? "critical" : pendingSignaturesCount > 1 ? "warning" : "info",
                metric_value: pendingSignaturesCount,
                metric_label: "Jobs",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${jobsPath}?pending_signatures=true`,
                data: { job_ids: pendingSignaturesJobIds.slice(0, 50), count: pendingSignaturesCount },
            });
        }
        // --- 4. Team productivity change vs previous period ---
        const prevSince = new Date(new Date(since).getTime() - PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
        const [currentMit, previousMit] = await Promise.all([
            supabaseClient_1.supabase
                .from("mitigation_items")
                .select("completed_by")
                .eq("organization_id", orgId)
                .not("completed_at", "is", null)
                .gte("completed_at", since)
                .lte("completed_at", until)
                .limit(MAX_JOBS),
            supabaseClient_1.supabase
                .from("mitigation_items")
                .select("completed_by")
                .eq("organization_id", orgId)
                .not("completed_at", "is", null)
                .gte("completed_at", prevSince)
                .lt("completed_at", since)
                .limit(MAX_JOBS),
        ]);
        const currentCompletions = (currentMit.data || []).length;
        const previousCompletions = (previousMit.data || []).length;
        const change = previousCompletions === 0 ? (currentCompletions > 0 ? 100 : 0) : ((currentCompletions - previousCompletions) / previousCompletions) * 100;
        insights.push({
            id: id(),
            type: "team_productivity",
            title: "Team productivity vs previous period",
            description: previousCompletions === 0
                ? `Current period: ${currentCompletions} completions (no prior period data).`
                : `Completions ${change >= 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 100) / 100}% vs previous ${PERIOD_DAYS} days (${currentCompletions} vs ${previousCompletions}).`,
            severity: change < -40 ? "critical" : change < -20 ? "warning" : "info",
            metric_value: Math.round(change * 100) / 100,
            metric_label: "% change",
            period_days: PERIOD_DAYS,
            created_at: new Date().toISOString(),
            action_url: `${analyticsPath}/team-performance`,
            data: { current_completions: currentCompletions, previous_completions: previousCompletions, change_pct: change },
        });
        // --- 5. Overdue tasks (full count from RPC) ---
        const overdueCount = Number(dueCounts.overdue_count ?? 0);
        const overdueJobIds = (dueCounts.overdue_job_ids ?? []);
        if (overdueCount > 0) {
            insights.push({
                id: id(),
                type: "overdue_tasks",
                title: "Overdue tasks",
                description: `${overdueCount} job(s) are past due and not yet completed.`,
                severity: overdueCount > 10 ? "critical" : overdueCount > 3 ? "warning" : "info",
                metric_value: overdueCount,
                metric_label: "Overdue",
                period_days: PERIOD_DAYS,
                created_at: new Date().toISOString(),
                action_url: `${jobsPath}?overdue=true`,
                data: { job_ids: overdueJobIds.slice(0, 50), count: overdueCount },
            });
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