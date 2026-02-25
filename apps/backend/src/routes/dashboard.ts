import express, { type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";

export const dashboardRouter: ExpressRouter = express.Router();

const PERIOD_DAYS = { "7d": 7, "30d": 30 } as const;
type PeriodKey = keyof typeof PERIOD_DAYS;

function parsePeriod(value?: string | string[]): { days: number; key: PeriodKey } {
  const str = value ? (Array.isArray(value) ? value[0] : value) : "30d";
  const key = (str === "7d" || str === "30d" ? str : "30d") as PeriodKey;
  return { days: PERIOD_DAYS[key], key };
}

function dateRangeForDays(days: number): { since: string; until: string } {
  const until = new Date();
  until.setHours(23, 59, 59, 999);
  const since = new Date(until.getTime());
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return { since: since.toISOString(), until: until.toISOString() };
}

function trendFromValues(current: number, previous: number): { trend_direction: "up" | "down" | "flat"; trend_percentage: number } {
  if (previous === 0) {
    return { trend_direction: current > 0 ? "up" : "flat", trend_percentage: current > 0 ? 100 : 0 };
  }
  const pct = ((current - previous) / previous) * 100;
  const trend_direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return { trend_direction, trend_percentage: Math.round(Math.abs(pct) * 100) / 100 };
}

type JobRow = {
  id: string;
  status: string | null;
  risk_score: number | null;
  risk_level: string | null;
  created_at: string;
  due_date: string | null;
  updated_at?: string | null;
  client_name?: string;
  job_type?: string;
  location?: string;
};

// GET /api/dashboard/summary
// Accepts period=7d|30d. Returns KPIs with trend_vs_previous (current vs preceding period). No job cap; query by date range. Includes on-time/overdue.
dashboardRouter.get(
  "/summary",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { organization_id } = authReq.user;
      const { days, key: periodKey } = parsePeriod(req.query.period as string);

      const { since: currentSince, until: currentUntil } = dateRangeForDays(days);
      const previousEnd = new Date(currentSince);
      previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);
      const previousSince = new Date(previousEnd.getTime());
      previousSince.setDate(previousSince.getDate() - (days - 1));
      previousSince.setHours(0, 0, 0, 0);
      const previousRange = { since: previousSince.toISOString(), until: previousEnd.toISOString() };

      const selectFields = "id, status, risk_score, risk_level, created_at, due_date, updated_at, client_name, job_type, location";
      const [currentRes, previousRes] = await Promise.all([
        supabase
          .from("jobs")
          .select(selectFields)
          .eq("organization_id", organization_id)
          .is("deleted_at", null)
          .gte("created_at", currentSince)
          .lte("created_at", currentUntil),
        supabase
          .from("jobs")
          .select(selectFields)
          .eq("organization_id", organization_id)
          .is("deleted_at", null)
          .gte("created_at", previousRange.since)
          .lte("created_at", previousRange.until),
      ]);

      if (currentRes.error) throw currentRes.error;
      if (previousRes.error) throw previousRes.error;

      const currentJobs = (currentRes.data || []) as JobRow[];
      const previousJobs = (previousRes.data || []) as JobRow[];

      const jobs_total = currentJobs.length;
      const jobs_completed = currentJobs.filter((j) => (j.status?.toLowerCase() === "completed")).length;
      // Scale to 0–100 percentage to match compliance_rate and other analytics
      const completion_rate = jobs_total === 0 ? 0 : Math.round((jobs_completed / jobs_total) * 10000) / 100;
      const withRisk = currentJobs.filter((j) => j.risk_score != null);
      const avg_risk = withRisk.length === 0 ? 0 : Math.round((withRisk.reduce((a, j) => a + (j.risk_score ?? 0), 0) / withRisk.length) * 100) / 100;

      const currentJobIds = currentJobs.map((j) => j.id);
      const previousJobIds = previousJobs.map((j) => j.id);

      async function computeComplianceRate(jobIds: string[]): Promise<number> {
        if (jobIds.length === 0) return 0;
        const [sigRes, photoRes, checklistRes] = await Promise.all([
          supabase.from("signatures").select("job_id").eq("organization_id", organization_id).in("job_id", jobIds),
          supabase.from("documents").select("job_id").eq("organization_id", organization_id).eq("type", "photo").in("job_id", jobIds),
          supabase.from("mitigation_items").select("job_id, completed_at").eq("organization_id", organization_id).in("job_id", jobIds),
        ]);
        const jobsWithSig = new Set((sigRes.data || []).map((r: { job_id: string }) => r.job_id)).size;
        const jobsWithPhoto = new Set((photoRes.data || []).map((r: { job_id: string }) => r.job_id)).size;
        const mitigationList = (checklistRes.data || []) as { job_id: string; completed_at: string | null }[];
        // Per-job tally: job is checklist-complete when it has zero items or all items have completed_at
        const byJob: Record<string, { total: number; completed: number }> = {};
        for (const id of jobIds) byJob[id] = { total: 0, completed: 0 };
        for (const m of mitigationList) {
          if (!byJob[m.job_id]) continue;
          byJob[m.job_id].total += 1;
          if (m.completed_at) byJob[m.job_id].completed += 1;
        }
        const completedJobsWithChecklist = jobIds.filter(
          (jid) => byJob[jid].total === 0 || byJob[jid].completed === byJob[jid].total
        ).length;
        const sigRate = jobsWithSig / jobIds.length;
        const photoRate = jobsWithPhoto / jobIds.length;
        const checklistRate = completedJobsWithChecklist / jobIds.length;
        return (sigRate + photoRate + checklistRate) / 3;
      }

      const [compliance_rate_fraction, prev_compliance_rate_fraction] = await Promise.all([
        computeComplianceRate(currentJobIds),
        computeComplianceRate(previousJobIds),
      ]);
      // Expose as 0–100 percent to align with /api/analytics/compliance-rate
      const compliance_rate = Math.round(compliance_rate_fraction * 10000) / 100;
      const prev_compliance_rate = Math.round(prev_compliance_rate_fraction * 10000) / 100;

      const prev_total = previousJobs.length;
      const prev_completed = previousJobs.filter((j) => (j.status?.toLowerCase() === "completed")).length;
      // Same unit (0–100 percent) for trend comparison
      const prev_completion_rate = prev_total === 0 ? 0 : Math.round((prev_completed / prev_total) * 10000) / 100;
      const prev_with_risk = previousJobs.filter((j) => j.risk_score != null);
      const prev_avg_risk = prev_with_risk.length === 0 ? 0 : prev_with_risk.reduce((a, j) => a + (j.risk_score ?? 0), 0) / prev_with_risk.length;

      const now = new Date();
      const on_time_count = currentJobs.filter((j) => {
        if ((j.status?.toLowerCase() !== "completed") || !j.due_date) return false;
        const due = new Date(j.due_date).getTime();
        const completedAt = j.updated_at ? new Date(j.updated_at).getTime() : now.getTime();
        return completedAt <= due;
      }).length;
      const overdue_count = currentJobs.filter((j) => {
        if (!j.due_date) return false;
        const due = new Date(j.due_date).getTime();
        if ((j.status?.toLowerCase() === "completed")) {
          const completedAt = j.updated_at ? new Date(j.updated_at).getTime() : now.getTime();
          return completedAt > due;
        }
        return now.getTime() > due;
      }).length;

      const trend_vs_previous = {
        jobs_total: trendFromValues(jobs_total, prev_total),
        jobs_completed: trendFromValues(jobs_completed, prev_completed),
        completion_rate: trendFromValues(completion_rate, prev_completion_rate),
        avg_risk: trendFromValues(avg_risk, prev_avg_risk),
        compliance_rate: trendFromValues(compliance_rate, prev_compliance_rate),
      };

      const allJobsForLists = currentJobs.slice(0, 500);
      const jobsAtRisk = allJobsForLists
        .filter((j) => (j.risk_score ?? 0) >= 70)
        .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
        .slice(0, 10)
        .map((job) => ({
          id: job.id,
          client_name: job.client_name,
          job_type: job.job_type,
          location: job.location,
          status: job.status,
          risk_score: job.risk_score,
          risk_level: job.risk_level,
          created_at: job.created_at,
        }));

      const jobIds = allJobsForLists.map((j) => j.id);
      const evidenceByJob: Record<string, number> = {};
      if (jobIds.length > 0) {
        const { data: docs } = await supabase.from("documents").select("job_id").in("job_id", jobIds);
        (docs || []).forEach((d: { job_id: string }) => {
          evidenceByJob[d.job_id] = (evidenceByJob[d.job_id] || 0) + 1;
        });
      }
      const missingEvidenceJobs = allJobsForLists
        .filter((job) => (evidenceByJob[job.id] || 0) < 3)
        .slice(0, 10)
        .map((job) => ({
          id: job.id,
          client_name: job.client_name,
          job_type: job.job_type,
          location: job.location,
          status: job.status,
          risk_score: job.risk_score,
          risk_level: job.risk_level,
          created_at: job.created_at,
        }));

      const chartDays = 7;
      const chartData: { date: string; value: number }[] = [];
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        d.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);
        const dayJobs = currentJobs.filter((j) => {
          const t = new Date(j.created_at).getTime();
          return t >= d.getTime() && t <= dayEnd.getTime();
        });
        const completed = dayJobs.filter((j) => (j.status?.toLowerCase() === "completed")).length;
        chartData.push({
          date: d.toISOString().split("T")[0],
          value: dayJobs.length === 0 ? 0 : Math.round((completed / dayJobs.length) * 100),
        });
      }

      res.json({
        period: periodKey,
        jobs_total,
        jobs_completed,
        completion_rate,
        avg_risk,
        compliance_rate,
        trend_vs_previous,
        on_time_count,
        overdue_count,
        data: {
          kpis: {
            jobs_total,
            jobs_completed,
            completion_rate,
            avg_risk,
            compliance_rate,
            trend_vs_previous,
            on_time_count,
            overdue_count,
          },
          jobsAtRisk,
          missingEvidenceJobs,
          chartData,
        },
      });
    } catch (err: any) {
      console.error("[Dashboard] Summary fetch failed:", err);
      res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
  }
);

// GET /api/dashboard/top-hazards
// Returns aggregated top hazards without per-job loops
dashboardRouter.get(
  "/top-hazards",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { organization_id } = authReq.user;

      // Fetch mitigation items (hazards) for all jobs
      const { data: mitigationItems, error: mitigationError } = await supabase
        .from("mitigation_items")
        .select("factor_id, title, code")
        .eq("organization_id", organization_id)
        .limit(1000);

      if (mitigationError) {
        throw mitigationError;
      }

      // Count occurrences by code/factor_id
      const hazardCounts: Record<string, number> = {};
      mitigationItems?.forEach((item) => {
        const key = item.code || item.factor_id || "UNKNOWN";
        hazardCounts[key] = (hazardCounts[key] || 0) + 1;
      });

      // Convert to sorted array
      const topHazards = Object.entries(hazardCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([code, count], index) => ({
          id: `hazard-${index}`,
          code,
          name: code,
          description: "",
          severity: "medium",
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

      res.json({ data: topHazards });
    } catch (err: any) {
      console.error("[Dashboard] Top hazards fetch failed:", err);
      res.status(500).json({ message: "Failed to fetch top hazards" });
    }
  }
);
