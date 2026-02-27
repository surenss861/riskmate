/**
 * Predictive insights service: generates insight objects for an organization
 * based on jobs, compliance, risk, and team activity. Used by GET /api/analytics/insights.
 * Spec: deadline_risk, risk_pattern, pending_signatures, team_productivity, overdue_tasks.
 */

import { supabase } from "../lib/supabaseClient";

/** Spec-compliant type strings returned by /api/analytics/insights. */
export type InsightType =
  | "deadline_risk"
  | "risk_pattern"
  | "pending_signatures"
  | "team_productivity"
  | "overdue_tasks";

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

const PERIOD_DAYS = 30;
const MAX_JOBS = 10000;
const DEADLINE_RISK_DAYS = 2;
/** Window for due-soon / pending-signature insights (days from now). */
const DUE_WINDOW_DAYS = 7;

function dateRange(days: number): { since: string; until: string } {
  const until = new Date();
  until.setHours(23, 59, 59, 999);
  const since = new Date(until.getTime());
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return { since: since.toISOString(), until: until.toISOString() };
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
export async function generateInsights(orgId: string, options?: GenerateInsightsOptions): Promise<Insight[]> {
  const insights: Insight[] = [];
  const { since, until } =
    options?.since && options?.until
      ? { since: options.since, until: options.until }
      : dateRange(PERIOD_DAYS);
  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  /** Reference date for drill-down links so list matches insight cohort (period end). Defined before first use. */
  const ref = untilDate;
  const periodDays = Math.max(1, Math.round((untilDate.getTime() - sinceDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  /** Deterministic ID from type + orgId + period range so same insight gets same ID across fetches; dismissals are period-scoped. */
  const stableId = (type: InsightType, keyData: string) =>
    `insight-${type}-${orgId}-${since.slice(0, 10)}-${until.slice(0, 10)}-${keyData}`;

  /** Use /operations routes so insight action links open valid filtered views (no /dashboard/* routes). */
  const basePath = "/operations";
  const jobsPath = `${basePath}/jobs`;
  const analyticsPath = basePath;
  const referenceDateIso = ref.toISOString();
  const insightQuery = (insight: string) =>
    `insight=${encodeURIComponent(insight)}&reference_date=${encodeURIComponent(referenceDateIso)}`;

  try {
    const refMs = ref.getTime();
    const nowIso = ref.toISOString();
    const twoDaysLater = new Date(refMs + DEADLINE_RISK_DAYS * 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(refMs + DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Full counts and limited payload via RPC (no cap; metrics reflect full set)
    const { data: dueCountsRows, error: dueCountsError } = await supabase.rpc("get_insights_due_counts", {
      p_org_id: orgId,
      p_now: nowIso,
      p_two_days_later: twoDaysLater.toISOString(),
      p_seven_days_later: sevenDaysLater.toISOString(),
    });
    if (dueCountsError) return insights;
    const dueCounts = Array.isArray(dueCountsRows) ? dueCountsRows[0] : dueCountsRows;
    if (!dueCounts) return insights;

    const deadlineRiskCount = Number(dueCounts.deadline_risk_count ?? 0);
    const deadlineRiskJobIds = (dueCounts.deadline_risk_job_ids ?? []) as string[];

    // --- 1. Deadline risk: open jobs <50% complete with <2 days to due (full count from RPC) ---
    if (deadlineRiskCount > 0) {
      insights.push({
        id: stableId("deadline_risk", "default"),
        type: "deadline_risk",
        title: "Deadline risk",
        description: `${deadlineRiskCount} job(s) are less than 50% complete with under ${DEADLINE_RISK_DAYS} days to due date.`,
        severity: deadlineRiskCount > 5 ? "critical" : deadlineRiskCount > 2 ? "warning" : "info",
        metric_value: deadlineRiskCount,
        metric_label: "Jobs at risk",
        period_days: periodDays,
        created_at: new Date().toISOString(),
        action_url: `${jobsPath}?${insightQuery("deadline_risk")}`,
        data: { job_ids: deadlineRiskJobIds.slice(0, 50), count: deadlineRiskCount },
      });
    }

    // --- 2. Recurring high-risk patterns by job_type and day-of-week (use jobs created in period) ---
    const { data: periodJobs, error: periodJobsError } = await supabase
      .from("jobs")
      .select("id, status, risk_score, risk_level, created_at, due_date, job_type")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .gte("created_at", since)
      .lte("created_at", until)
      .limit(MAX_JOBS);

    const periodJobList = (periodJobsError ? [] : (periodJobs || [])) as {
      id: string;
      status: string | null;
      risk_score: number | null;
      risk_level: string | null;
      created_at: string;
      due_date: string | null;
      job_type: string | null;
    }[];
    const highRiskJobs = periodJobList.filter((j) => (j.risk_score ?? 0) >= 70);
    const bucketCount: Record<string, number> = {};
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
        id: stableId("risk_pattern", `${top[0]}-${top[1]}`),
        type: "risk_pattern",
        title: "Recurring high-risk pattern",
        description: `High-risk jobs concentrate on ${dayNames[parseInt(dayNum, 10)]} for job type "${jobType}" (${top[1]} in period).`,
        severity: top[1] >= 5 ? "critical" : top[1] >= 3 ? "warning" : "info",
        metric_value: top[1],
        metric_label: "Occurrences",
        period_days: periodDays,
        created_at: new Date().toISOString(),
        action_url: analyticsPath,
        data: { job_type: jobType, day_of_week: parseInt(dayNum, 10), count: top[1], patterns: recurringEntries.slice(0, 10).map(([k, v]) => ({ bucket: k, count: v })) },
      });
    }

    // --- 3. Pending signatures near compliance deadlines (full count from RPC) ---
    const pendingSignaturesCount = Number(dueCounts.pending_signatures_count ?? 0);
    const pendingSignaturesJobIds = (dueCounts.pending_signatures_job_ids ?? []) as string[];
    if (pendingSignaturesCount > 0) {
      insights.push({
        id: stableId("pending_signatures", "default"),
        type: "pending_signatures",
        title: "Pending signatures near deadline",
        description: `${pendingSignaturesCount} job(s) have no signature and are within 7 days of compliance deadline.`,
        severity: pendingSignaturesCount > 3 ? "critical" : pendingSignaturesCount > 1 ? "warning" : "info",
        metric_value: pendingSignaturesCount,
        metric_label: "Jobs",
        period_days: periodDays,
        created_at: new Date().toISOString(),
        action_url: `${jobsPath}?${insightQuery("pending_signatures_near_deadline")}`,
        data: { job_ids: pendingSignaturesJobIds.slice(0, 50), count: pendingSignaturesCount },
      });
    }

    // --- 4. Team productivity change vs previous period ---
    const periodMs = untilDate.getTime() - sinceDate.getTime();
    const prevUntil = since;
    const prevSince = new Date(sinceDate.getTime() - periodMs).toISOString();
    const [currentMit, previousMit] = await Promise.all([
      supabase
        .from("mitigation_items")
        .select("completed_by")
        .eq("organization_id", orgId)
        .not("completed_at", "is", null)
        .gte("completed_at", since)
        .lte("completed_at", until)
        .limit(MAX_JOBS),
      supabase
        .from("mitigation_items")
        .select("completed_by")
        .eq("organization_id", orgId)
        .not("completed_at", "is", null)
        .gte("completed_at", prevSince)
        .lt("completed_at", prevUntil)
        .limit(MAX_JOBS),
    ]);
    const currentCompletions = (currentMit.data || []).length;
    const previousCompletions = (previousMit.data || []).length;
    const change = previousCompletions === 0 ? (currentCompletions > 0 ? 100 : 0) : ((currentCompletions - previousCompletions) / previousCompletions) * 100;
    insights.push({
      id: stableId("team_productivity", "default"),
      type: "team_productivity",
      title: "Team productivity vs previous period",
      description:
        previousCompletions === 0
          ? `Current period: ${currentCompletions} completions (no prior period data).`
          : `Completions ${change >= 0 ? "up" : "down"} ${Math.round(Math.abs(change) * 100) / 100}% vs previous ${periodDays} days (${currentCompletions} vs ${previousCompletions}).`,
      severity: change < -40 ? "critical" : change < -20 ? "warning" : "info",
      metric_value: Math.round(change * 100) / 100,
      metric_label: "% change",
      period_days: periodDays,
      created_at: new Date().toISOString(),
      action_url: analyticsPath,
      data: { current_completions: currentCompletions, previous_completions: previousCompletions, change_pct: change },
    });

    // --- 5. Overdue tasks (full count from RPC) ---
    const overdueCount = Number(dueCounts.overdue_count ?? 0);
    const overdueJobIds = (dueCounts.overdue_job_ids ?? []) as string[];
    if (overdueCount > 0) {
      insights.push({
        id: stableId("overdue_tasks", "default"),
        type: "overdue_tasks",
        title: "Overdue tasks",
        description: `${overdueCount} job(s) are past due and not yet completed.`,
        severity: overdueCount > 10 ? "critical" : overdueCount > 3 ? "warning" : "info",
        metric_value: overdueCount,
        metric_label: "Overdue",
        period_days: periodDays,
        created_at: new Date().toISOString(),
        action_url: `${jobsPath}?${insightQuery("overdue")}`,
        data: { job_ids: overdueJobIds.slice(0, 50), count: overdueCount },
      });
    }

    // Sort by severity weight then by metric relevance
    const severityOrder: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || (b.metric_value ?? 0) - (a.metric_value ?? 0));
  } catch (e) {
    console.error("generateInsights error:", e);
  }
  return insights;
}
