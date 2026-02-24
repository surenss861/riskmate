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
/** Cap for due-relevance job query (performance). */
const DUE_JOBS_CAP = 2000;

function dateRange(days: number): { since: string; until: string } {
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
export async function generateInsights(orgId: string): Promise<Insight[]> {
  const insights: Insight[] = [];
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

    // Due-relevance: open/active jobs with due_date in window (overdue or due within 7 days). No created_at filter so older active jobs are included.
    const { data: dueRelevanceJobs, error: dueJobsError } = await supabase
      .from("jobs")
      .select("id, status, risk_score, risk_level, created_at, due_date, job_type")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .not("due_date", "is", null)
      .lte("due_date", sevenDaysFromNow.toISOString())
      .order("due_date", { ascending: true })
      .limit(DUE_JOBS_CAP);

    if (dueJobsError) return insights;
    const dueJobList = (dueRelevanceJobs || []) as {
      id: string;
      status: string | null;
      risk_score: number | null;
      risk_level: string | null;
      created_at: string;
      due_date: string | null;
      job_type: string | null;
    }[];

    // --- 1. Deadline risk: open jobs <50% complete with <2 days to due ---
    const openJobIdsWithDueSoon = dueJobList
      .filter((j) => {
        if (j.status?.toLowerCase() === "completed") return false;
        if (!j.due_date) return false;
        const due = new Date(j.due_date).getTime();
        return due <= twoDaysFromNow.getTime() && due >= now.getTime();
      })
      .map((j) => j.id);

    let deadlineRiskJobIds: string[] = [];
    if (openJobIdsWithDueSoon.length > 0) {
      const { data: mitigations } = await supabase
        .from("mitigation_items")
        .select("job_id, completed_at")
        .eq("organization_id", orgId)
        .in("job_id", openJobIdsWithDueSoon)
        .limit(MAX_JOBS);

      const byJob: Record<string, { total: number; completed: number }> = {};
      for (const jid of openJobIdsWithDueSoon) byJob[jid] = { total: 0, completed: 0 };
      (mitigations || []).forEach((m: { job_id: string; completed_at: string | null }) => {
        if (!byJob[m.job_id]) return;
        byJob[m.job_id].total += 1;
        if (m.completed_at) byJob[m.job_id].completed += 1;
      });
      deadlineRiskJobIds = openJobIdsWithDueSoon.filter((jid) => {
        const { total, completed } = byJob[jid];
        const pct = total === 0 ? 0 : completed / total;
        return pct < 0.5;
      });
    }
    if (deadlineRiskJobIds.length > 0) {
      insights.push({
        id: id(),
        type: "deadline_risk",
        title: "Deadline risk",
        description: `${deadlineRiskJobIds.length} job(s) are less than 50% complete with under ${DEADLINE_RISK_DAYS} days to due date.`,
        severity: deadlineRiskJobIds.length > 5 ? "critical" : deadlineRiskJobIds.length > 2 ? "warning" : "info",
        metric_value: deadlineRiskJobIds.length,
        metric_label: "Jobs at risk",
        period_days: PERIOD_DAYS,
        created_at: new Date().toISOString(),
        action_url: `${jobsPath}?due_soon=true`,
        data: { job_ids: deadlineRiskJobIds.slice(0, 50), count: deadlineRiskJobIds.length },
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

    // --- 3. Pending signatures near compliance deadlines (due within 7 days, no created_at filter) ---
    const dueInSevenDays = dueJobList.filter((j) => {
      if (!j.due_date) return false;
      const due = new Date(j.due_date).getTime();
      const daysToDue = (due - now.getTime()) / (24 * 60 * 60 * 1000);
      return daysToDue >= 0 && daysToDue <= DUE_WINDOW_DAYS;
    });
    const dueInSevenIds = dueInSevenDays.map((j) => j.id);
    if (dueInSevenIds.length > 0) {
      const { data: sigs } = await supabase
        .from("signatures")
        .select("job_id")
        .eq("organization_id", orgId)
        .in("job_id", dueInSevenIds)
        .limit(MAX_JOBS);
      const jobsWithSignature = new Set((sigs || []).map((r: { job_id: string }) => r.job_id));
      const nearDeadline = dueInSevenDays.filter((j) => !jobsWithSignature.has(j.id));
      if (nearDeadline.length > 0) {
        insights.push({
          id: id(),
          type: "pending_signatures",
          title: "Pending signatures near deadline",
          description: `${nearDeadline.length} job(s) have no signature and are within 7 days of compliance deadline.`,
          severity: nearDeadline.length > 3 ? "critical" : nearDeadline.length > 1 ? "warning" : "info",
          metric_value: nearDeadline.length,
          metric_label: "Jobs",
          period_days: PERIOD_DAYS,
          created_at: new Date().toISOString(),
          action_url: `${jobsPath}?pending_signatures=true`,
          data: { job_ids: nearDeadline.map((j) => j.id).slice(0, 50), count: nearDeadline.length },
        });
      }
    }

    // --- 4. Team productivity change vs previous period ---
    const prevSince = new Date(new Date(since).getTime() - PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();
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
      description:
        previousCompletions === 0
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

    // --- 5. Overdue tasks (open jobs with due_date < now; no created_at filter) ---
    const overdueCount = dueJobList.filter(
      (j) => j.status?.toLowerCase() !== "completed" && j.due_date != null && j.due_date < nowIso
    ).length;
    if (overdueCount > 0) {
      const overdueIds = dueJobList
        .filter((j) => j.status?.toLowerCase() !== "completed" && j.due_date != null && j.due_date < nowIso)
        .map((j) => j.id);
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
        data: { job_ids: overdueIds.slice(0, 50), count: overdueCount },
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
