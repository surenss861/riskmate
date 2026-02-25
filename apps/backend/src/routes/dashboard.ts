import express, { type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";

export const dashboardRouter: ExpressRouter = express.Router();

const PERIOD_DAYS = { "7d": 7, "30d": 30 } as const;
type PeriodKey = keyof typeof PERIOD_DAYS;

const PAGE_SIZE = 500;

/** Fetch all rows by paginating with .range(); no default row limit. */
async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<{ data: T[] | null; error: any }>
): Promise<{ data: T[]; error: any }> {
  const out: T[] = [];
  let offset = 0;
  let hasMore = true;
  let lastError: any = null;
  while (hasMore) {
    const { data, error } = await fetchPage(offset, PAGE_SIZE);
    if (error) return { data: out, error };
    lastError = error;
    const chunkData = data ?? [];
    out.push(...chunkData);
    hasMore = chunkData.length === PAGE_SIZE;
    offset += chunkData.length;
  }
  return { data: out, error: lastError };
}

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
  completed_at?: string | null;
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

      const selectFields = "id, status, risk_score, risk_level, created_at, due_date, completed_at, updated_at, client_name, job_type, location";
      const [currentPaginated, previousPaginated, currentKpisRes, previousKpisRes] = await Promise.all([
        fetchAllPages<JobRow>(async (offset, limit) => {
          const { data, error } = await supabase
            .from("jobs")
            .select(selectFields)
            .eq("organization_id", organization_id)
            .is("deleted_at", null)
            .gte("created_at", currentSince)
            .lte("created_at", currentUntil)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
          return { data, error };
        }),
        fetchAllPages<JobRow>(async (offset, limit) => {
          const { data, error } = await supabase
            .from("jobs")
            .select(selectFields)
            .eq("organization_id", organization_id)
            .is("deleted_at", null)
            .gte("created_at", previousRange.since)
            .lte("created_at", previousRange.until)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);
          return { data, error };
        }),
        supabase.rpc("get_compliance_rate_kpis", {
          p_org_id: organization_id,
          p_since: currentSince,
          p_until: currentUntil,
        }),
        supabase.rpc("get_compliance_rate_kpis", {
          p_org_id: organization_id,
          p_since: previousRange.since,
          p_until: previousRange.until,
        }),
      ]);

      if (currentPaginated.error) throw currentPaginated.error;
      if (previousPaginated.error) throw previousPaginated.error;
      if (currentKpisRes.error) throw currentKpisRes.error;
      if (previousKpisRes.error) throw previousKpisRes.error;

      const currentJobs = (currentPaginated.data || []) as JobRow[];
      const previousJobs = (previousPaginated.data || []) as JobRow[];

      const jobs_total = currentJobs.length;
      const jobs_completed = currentJobs.filter((j) => (j.status?.toLowerCase() === "completed")).length;
      // Scale to 0–100 percentage to match compliance_rate and other analytics
      const completion_rate = jobs_total === 0 ? 0 : Math.round((jobs_completed / jobs_total) * 10000) / 100;
      const withRisk = currentJobs.filter((j) => j.risk_score != null);
      const avg_risk = withRisk.length === 0 ? 0 : Math.round((withRisk.reduce((a, j) => a + (j.risk_score ?? 0), 0) / withRisk.length) * 100) / 100;

      // Compliance from RPC so all jobs in period are counted (no 1k .in() limit)
      const currentKpis = Array.isArray(currentKpisRes.data) ? currentKpisRes.data[0] : currentKpisRes.data;
      const previousKpis = Array.isArray(previousKpisRes.data) ? previousKpisRes.data[0] : previousKpisRes.data;
      const totalCurrent = Number(currentKpis?.total_jobs ?? 0);
      const totalPrevious = Number(previousKpis?.total_jobs ?? 0);
      const compliance_rate_fraction =
        totalCurrent === 0
          ? 0
          : ((Number(currentKpis?.jobs_with_signature ?? 0) / totalCurrent) +
              (Number(currentKpis?.jobs_with_photo ?? 0) / totalCurrent) +
              (Number(currentKpis?.jobs_checklist_complete ?? 0) / totalCurrent)) /
            3;
      const prev_compliance_rate_fraction =
        totalPrevious === 0
          ? 0
          : ((Number(previousKpis?.jobs_with_signature ?? 0) / totalPrevious) +
              (Number(previousKpis?.jobs_with_photo ?? 0) / totalPrevious) +
              (Number(previousKpis?.jobs_checklist_complete ?? 0) / totalPrevious)) /
            3;
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
        const completedAt = (j.completed_at != null ? new Date(j.completed_at) : new Date(j.created_at)).getTime();
        return completedAt <= due;
      }).length;
      const overdue_count = currentJobs.filter((j) => {
        if (!j.due_date) return false;
        const due = new Date(j.due_date).getTime();
        if ((j.status?.toLowerCase() === "completed")) {
          const completedAt = (j.completed_at != null ? new Date(j.completed_at) : new Date(j.created_at)).getTime();
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

      const jobIds = currentJobs.map((j) => j.id);
      const evidenceByJob: Record<string, number> = {};
      if (jobIds.length > 0) {
        for (let i = 0; i < jobIds.length; i += PAGE_SIZE) {
          const chunk = jobIds.slice(i, i + PAGE_SIZE);
          const { data: docs } = await supabase.from("documents").select("job_id").eq("organization_id", organization_id).in("job_id", chunk);
          (docs || []).forEach((d: { job_id: string }) => {
            evidenceByJob[d.job_id] = (evidenceByJob[d.job_id] || 0) + 1;
          });
        }
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
