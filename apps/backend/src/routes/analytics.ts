import express, { type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { requireFeature } from "../middleware/limits";
import { generateInsights } from "../services/insights";

export const analyticsRouter: ExpressRouter = express.Router();

// In-memory cache for insights: 1h TTL per org
const INSIGHTS_CACHE_TTL_MS = 60 * 60 * 1000;
const insightsCache = new Map<string, { data: ReturnType<typeof generateInsights> extends Promise<infer T> ? T : never; expires: number }>();

async function getCachedInsights(orgId: string) {
  const entry = insightsCache.get(orgId);
  if (entry && Date.now() < entry.expires) return entry.data;
  const data = await generateInsights(orgId);
  insightsCache.set(orgId, { data, expires: Date.now() + INSIGHTS_CACHE_TTL_MS });
  return data;
}

type MitigationItem = {
  id: string;
  job_id: string;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
};

type JobRecord = {
  id: string;
  risk_score: number | null;
  created_at: string;
};

type DocumentRecord = {
  id: string;
  job_id: string;
  created_at: string;
  type?: string;
};

const PAGE_SIZE = 2000;

/** Fetch all rows by paginating; no cap. */
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

/** Chunk array into batches of at most size. */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

const parseRangeDays = (value?: string | string[]) => {
  if (!value) return 30;
  const str = Array.isArray(value) ? value[0] : value;
  const match = str.match(/(\d+)/);
  if (!match) return 30;
  const days = parseInt(match[1], 10);
  if (Number.isNaN(days) || days <= 0) return 30;
  return Math.min(days, 180);
};

const toDateKey = (value: string) => value.slice(0, 10);

// --- Period parsing for analytics (7d, 30d, 90d, 1y) ---
const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 } as const;
type PeriodKey = keyof typeof PERIOD_DAYS;

const parsePeriod = (value?: string | string[]): { days: number; key: PeriodKey } => {
  const str = value ? (Array.isArray(value) ? value[0] : value) : "30d";
  const key = (str === "7d" || str === "30d" || str === "90d" || str === "1y" ? str : "30d") as PeriodKey;
  return { days: PERIOD_DAYS[key], key };
};

const dateRangeForDays = (days: number): { since: string; until: string } => {
  const until = new Date();
  until.setHours(23, 59, 59, 999);
  const since = new Date(until.getTime());
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  return { since: since.toISOString(), until: until.toISOString() };
};

// MV covers last 2 years; use for week/month bucketed analytics when in range
const MV_COVERAGE_DAYS = 730;

// Helpers for trends: bucket keys and labels
const weekStart = (d: Date): string => {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};
const monthStart = (d: Date): string => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
};

// GET /api/analytics/trends — metric (jobs|risk|compliance), period (7d|30d|90d|1y), groupBy (day|week|month)
// Response: { period, groupBy, metric, data: Array<{ period, value, label }> }
analyticsRouter.get(
  "/trends",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({ period: "30d", groupBy: "day", data: [], locked: true });
    }
    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days, key: periodKey } = parsePeriod(authReq.query.period as string);
      const groupByRaw = (authReq.query.groupBy as string) || "day";
      const groupBy = groupByRaw === "month" ? "month" : groupByRaw === "week" ? "week" : "day";
      const metricRaw = (authReq.query.metric as string) || "jobs";
      const metric =
        metricRaw === "risk"
          ? "risk"
          : metricRaw === "compliance"
            ? "compliance"
            : metricRaw === "completion" || metricRaw === "completion_rate"
              ? "completion"
              : "jobs";
      const { since, until } = dateRangeForDays(days);

      type Point = { period: string; value: number; label: string };
      const points: Point[] = [];
      const useMv = (groupBy === "week" || groupBy === "month") && days <= MV_COVERAGE_DAYS && metric !== "compliance";

      if (useMv) {
        const sinceWeek = weekStart(new Date(since));
        const untilWeek = weekStart(new Date(until));
        const { data: mvRows, error: mvError } = await fetchAllPages<{
          week_start: string;
          jobs_created: number;
          jobs_completed: number;
          avg_risk: number | null;
        }>(async (offset, limit) => {
          const { data, error } = await supabase
            .from("analytics_weekly_job_stats")
            .select("week_start, jobs_created, jobs_completed, avg_risk")
            .eq("organization_id", orgId)
            .gte("week_start", sinceWeek)
            .lte("week_start", untilWeek)
            .order("week_start", { ascending: true })
            .range(offset, offset + limit - 1);
          return { data, error };
        });

        if (!mvError && mvRows && mvRows.length > 0) {
          const rows = mvRows as { week_start: string; jobs_created: number; jobs_completed: number; avg_risk: number | null }[];
          if (groupBy === "week") {
            for (const r of rows) {
              const period = typeof r.week_start === "string" ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10);
              let value = 0;
              if (metric === "jobs") value = r.jobs_created ?? 0;
              else if (metric === "risk") value = r.avg_risk != null ? Math.round(r.avg_risk * 100) / 100 : 0;
              else if (metric === "completion")
                value = (r.jobs_created ?? 0) === 0 ? 0 : Math.round(((r.jobs_completed ?? 0) / (r.jobs_created ?? 1)) * 10000) / 100;
              points.push({ period, value, label: period });
            }
          } else {
            const byMonth = new Map<string, { jobs_created: number; jobs_completed: number; riskSum: number; riskWeight: number }>();
            for (const r of rows) {
              const period = monthStart(new Date(typeof r.week_start === "string" ? r.week_start : String(r.week_start)));
              const cur = byMonth.get(period) ?? { jobs_created: 0, jobs_completed: 0, riskSum: 0, riskWeight: 0 };
              cur.jobs_created += r.jobs_created ?? 0;
              cur.jobs_completed += r.jobs_completed ?? 0;
              if (r.avg_risk != null && (r.jobs_created ?? 0) > 0) {
                cur.riskSum += (r.avg_risk ?? 0) * (r.jobs_created ?? 0);
                cur.riskWeight += r.jobs_created ?? 0;
              }
              byMonth.set(period, cur);
            }
            for (const [period] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
              const cur = byMonth.get(period)!;
              let value = 0;
              if (metric === "jobs") value = cur.jobs_created;
              else if (metric === "risk") value = cur.riskWeight === 0 ? 0 : Math.round((cur.riskSum / cur.riskWeight) * 100) / 100;
              else if (metric === "completion")
                value = cur.jobs_created === 0 ? 0 : Math.round((cur.jobs_completed / cur.jobs_created) * 10000) / 100;
              points.push({ period, value, label: period });
            }
          }
          const periodLabel = periodKey === "1y" ? "1y" : `${days}d`;
          return res.json({ period: periodLabel, groupBy, metric, data: points });
        }
      }

      const { data: jobs, error: jobsError } = await fetchAllPages<{
        id: string;
        risk_score: number | null;
        status: string | null;
        created_at: string;
      }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, risk_score, status, created_at")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .gte("created_at", since)
          .lte("created_at", until)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        return { data, error };
      });

      if (jobsError) throw jobsError;
      const jobList = (jobs || []) as { id: string; risk_score: number | null; status: string | null; created_at: string }[];

      const getBucketKey = (date: Date) =>
        groupBy === "month" ? monthStart(date) : groupBy === "week" ? weekStart(date) : toDateKey(date.toISOString());

      const bucketValues = new Map<string, number>();
      const bucketRiskSums = new Map<string, { sum: number; count: number }>();
      const bucketCompletion = new Map<string, { total: number; completed: number }>();

      if (metric === "compliance" && jobList.length > 0) {
        const trendJobIds = jobList.map((j) => j.id);
        const jobsWithSigSet = new Set<string>();
        const jobsWithPhotoSet = new Set<string>();
        const mitigationList: { job_id: string; completed_at: string | null }[] = [];
        for (const idChunk of chunkArray(trendJobIds, 500)) {
          const [sigRes, photoRes, checklistRes] = await Promise.all([
            fetchAllPages<{ job_id: string }>(async (o, l) => {
              const { data, error } = await supabase
                .from("signatures")
                .select("job_id")
                .eq("organization_id", orgId)
                .in("job_id", idChunk)
                .order("signed_at", { ascending: false })
                .range(o, o + l - 1);
              return { data, error };
            }),
            fetchAllPages<{ job_id: string }>(async (o, l) => {
              const { data, error } = await supabase
                .from("documents")
                .select("job_id")
                .eq("organization_id", orgId)
                .eq("type", "photo")
                .in("job_id", idChunk)
                .order("created_at", { ascending: false })
                .range(o, o + l - 1);
              return { data, error };
            }),
            fetchAllPages<{ job_id: string; completed_at: string | null }>(async (o, l) => {
              const { data, error } = await supabase
                .from("mitigation_items")
                .select("job_id, completed_at")
                .eq("organization_id", orgId)
                .in("job_id", idChunk)
                .order("created_at", { ascending: false })
                .range(o, o + l - 1);
              return { data, error };
            }),
          ]);
          if (sigRes.error) throw sigRes.error;
          if (photoRes.error) throw photoRes.error;
          if (checklistRes.error) throw checklistRes.error;
          (sigRes.data ?? []).forEach((r) => jobsWithSigSet.add(r.job_id));
          (photoRes.data ?? []).forEach((r) => jobsWithPhotoSet.add(r.job_id));
          mitigationList.push(...(checklistRes.data ?? []));
        }

        // Per-job checklist: job is checklist-complete when all its mitigation items are completed (or it has none).
        const byJobTrend: Record<string, { total: number; completed: number }> = {};
        for (const j of jobList) byJobTrend[j.id] = { total: 0, completed: 0 };
        for (const m of mitigationList) {
          if (!byJobTrend[m.job_id]) continue;
          byJobTrend[m.job_id].total += 1;
          if (m.completed_at) byJobTrend[m.job_id].completed += 1;
        }
        const jobChecklistCompleteSet = new Set(
          jobList.filter(
            (j) => byJobTrend[j.id].total === 0 || byJobTrend[j.id].completed === byJobTrend[j.id].total
          ).map((j) => j.id)
        );
        type BucketCompliance = { jobIds: string[]; sigCount: number; photoCount: number; checklistCompleteCount: number };
        const bucketCompliance = new Map<string, BucketCompliance>();
        for (const j of jobList) {
          const key = getBucketKey(new Date(j.created_at));
          let cur = bucketCompliance.get(key);
          if (!cur) {
            cur = { jobIds: [], sigCount: 0, photoCount: 0, checklistCompleteCount: 0 };
            bucketCompliance.set(key, cur);
          }
          cur.jobIds.push(j.id);
          if (jobsWithSigSet.has(j.id)) cur.sigCount += 1;
          if (jobsWithPhotoSet.has(j.id)) cur.photoCount += 1;
          if (jobChecklistCompleteSet.has(j.id)) cur.checklistCompleteCount += 1;
        }
        for (const [period] of [...bucketCompliance.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          const cur = bucketCompliance.get(period)!;
          const n = cur.jobIds.length;
          const sigRate = n === 0 ? 0 : cur.sigCount / n;
          const photoRate = n === 0 ? 0 : cur.photoCount / n;
          const checklistRate = n === 0 ? 0 : cur.checklistCompleteCount / n;
          const value = (sigRate + photoRate + checklistRate) / 3;
          // Scale to 0–100 percentage to match /analytics/compliance-rate and other analytics endpoints
          const valuePct = Math.round(value * 10000) / 100;
          points.push({ period, value: valuePct, label: period });
        }
      } else {
        for (const j of jobList) {
          const key = getBucketKey(new Date(j.created_at));
          const completed = j.status?.toLowerCase() === "completed";
          if (metric === "completion") {
            const cur = bucketCompletion.get(key) ?? { total: 0, completed: 0 };
            cur.total += 1;
            if (completed) cur.completed += 1;
            bucketCompletion.set(key, cur);
          } else if (metric === "jobs") {
            bucketValues.set(key, (bucketValues.get(key) ?? 0) + 1);
          } else if (metric === "risk" && j.risk_score != null) {
            const cur = bucketRiskSums.get(key) ?? { sum: 0, count: 0 };
            cur.sum += j.risk_score;
            cur.count += 1;
            bucketRiskSums.set(key, cur);
          }
        }

        if (metric === "completion") {
          for (const [period] of [...bucketCompletion.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const { total, completed } = bucketCompletion.get(period)!;
            const value = total === 0 ? 0 : Math.round((completed / total) * 10000) / 100;
            points.push({ period, value, label: period });
          }
        } else if (metric === "jobs") {
          for (const [period] of [...bucketValues.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            points.push({ period, value: bucketValues.get(period) ?? 0, label: period });
          }
        } else if (metric === "risk") {
          for (const [period] of [...bucketRiskSums.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const { sum, count } = bucketRiskSums.get(period)!;
            const value = count === 0 ? 0 : Math.round((sum / count) * 100) / 100;
            points.push({ period, value, label: period });
          }
        }
      }

      const periodLabel = periodKey === "1y" ? "1y" : `${days}d`;
      return res.json({ period: periodLabel, groupBy, metric, data: points });
    } catch (error: any) {
      console.error("Analytics trends error:", error);
      return res.status(500).json({ message: "Failed to fetch analytics trends" });
    }
  }
);

// GET /api/analytics/risk-heatmap — aggregate by job_type and day_of_week (30d/90d), avg_risk and count per bucket
analyticsRouter.get(
  "/risk-heatmap",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({ buckets: [], locked: true });
    }
    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: jobs, error } = await fetchAllPages<{
        job_type: string | null;
        risk_score: number | null;
        created_at: string;
      }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from("jobs")
          .select("job_type, risk_score, created_at")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .gte("created_at", since)
          .lte("created_at", until)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        return { data, error };
      });

      if (error) throw error;
      const list = (jobs || []) as { job_type: string | null; risk_score: number | null; created_at: string }[];

      type BucketKey = string;
      const bucketSums: Record<BucketKey, { sum: number; count: number; riskCount: number }> = {};
      for (const j of list) {
        const jobType = j.job_type ?? "other";
        const dayOfWeek = new Date(j.created_at).getUTCDay();
        const key = `${jobType}|${dayOfWeek}`;
        if (!bucketSums[key]) bucketSums[key] = { sum: 0, count: 0, riskCount: 0 };
        bucketSums[key].count += 1;
        if (j.risk_score != null) {
          bucketSums[key].sum += j.risk_score;
          bucketSums[key].riskCount += 1;
        }
      }

      const buckets = Object.entries(bucketSums).map(([key, { sum, count, riskCount }]) => {
        const [job_type, day_of_week_str] = key.split("|");
        const avg_risk = riskCount === 0 ? 0 : Math.round((sum / riskCount) * 100) / 100;
        return { job_type, day_of_week: parseInt(day_of_week_str, 10), avg_risk, count };
      });
      return res.json({ period: `${days}d`, buckets });
    } catch (error: any) {
      console.error("Analytics risk-heatmap error:", error);
      return res.status(500).json({ message: "Failed to fetch risk heatmap" });
    }
  }
);

// GET /api/analytics/team-performance — jobs_assigned, jobs_completed, completion_rate, avg_days, overdue_count per user
// Server-side aggregate via get_team_performance_kpis RPC; jobs_assigned includes all open assigned (including pre-period).
analyticsRouter.get(
  "/team-performance",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({ members: [], locked: true });
    }
    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: kpiRows, error: rpcError } = await supabase.rpc("get_team_performance_kpis", {
        p_org_id: orgId,
        p_since: since,
        p_until: until,
      });
      if (rpcError) throw rpcError;
      const rows = (Array.isArray(kpiRows) ? kpiRows : []) as {
        user_id: string;
        jobs_assigned: number;
        jobs_completed: number;
        sum_days: number;
        count_completed: number;
        overdue_count: number;
      }[];

      const members = rows.map((r) => {
        const jobs_assigned = Number(r.jobs_assigned ?? 0);
        const jobs_completed = Number(r.jobs_completed ?? 0);
        const completion_rate =
          jobs_assigned === 0 ? 0 : Math.round((jobs_completed / jobs_assigned) * 10000) / 100;
        const count_completed = Number(r.count_completed ?? 0);
        const sum_days = Number(r.sum_days ?? 0);
        const avg_days =
          count_completed === 0 ? 0 : Math.round((sum_days / count_completed) * 100) / 100;
        return {
          user_id: r.user_id,
          jobs_assigned,
          jobs_completed,
          completion_rate,
          avg_days,
          overdue_count: Number(r.overdue_count ?? 0),
        };
      });
      members.sort((a, b) => b.jobs_completed - a.jobs_completed);
      const topMembers = members.slice(0, 50);
      const userIds = topMembers.map((m) => m.user_id);
      const userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: userRows } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", userIds);
        for (const u of userRows || []) {
          const name = (u as { id: string; full_name: string | null }).full_name ?? "";
          userMap.set((u as { id: string }).id, name.trim() || "Unknown");
        }
      }
      const membersWithNames = topMembers.map((m) => ({
        ...m,
        name: userMap.get(m.user_id) ?? "Unknown",
      }));
      return res.json({ period: `${days}d`, members: membersWithNames });
    } catch (error: any) {
      console.error("Analytics team-performance error:", error);
      return res.status(500).json({ message: "Failed to fetch team performance" });
    }
  }
);

// GET /api/analytics/hazard-frequency — groupBy type|location, count and avg_risk per category, trend vs previous window
analyticsRouter.get(
  "/hazard-frequency",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({ items: [], locked: true });
    }
    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);
      const groupBy = (authReq.query.groupBy as string) === "location" ? "location" : "type";

      const { data: items, error } = await fetchAllPages<{
        id: string;
        job_id: string;
        code: string | null;
        title: string | null;
        factor_id: string | null;
      }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from("mitigation_items")
          .select("id, job_id, code, title, factor_id")
          .eq("organization_id", orgId)
          .gte("created_at", since)
          .lte("created_at", until)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        return { data, error };
      });

      if (error) throw error;
      const itemList = (items ?? []) as { id: string; job_id: string; code: string | null; title: string | null; factor_id: string | null }[];
      const jobIds = [...new Set(itemList.map((m) => m.job_id))];

      const jobMap = new Map<string, { risk_score: number | null; location: string }>();
      for (const idChunk of chunkArray(jobIds, 500)) {
        const { data: jobsData } = await supabase
          .from("jobs")
          .select("id, risk_score, location")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .in("id", idChunk);
        for (const j of jobsData ?? []) {
          const row = j as { id: string; risk_score: number | null; location: string | null };
          jobMap.set(row.id, { risk_score: row.risk_score, location: row.location ?? "unknown" });
        }
      }

      type CatStats = { count: number; riskSum: number; riskCount: number };
      const current: Record<string, CatStats> = {};
      for (const m of itemList) {
        const category = groupBy === "location" ? (jobMap.get(m.job_id)?.location ?? "unknown") : (m.code || m.factor_id || m.title || "unknown");
        if (!current[category]) current[category] = { count: 0, riskSum: 0, riskCount: 0 };
        current[category].count += 1;
        const score = jobMap.get(m.job_id)?.risk_score;
        if (score != null) {
          current[category].riskSum += score;
          current[category].riskCount += 1;
        }
      }

      const prevSince = new Date(new Date(since).getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const prevUntil = since;
      const { data: prevItems } = await fetchAllPages<{
        id: string;
        job_id: string;
        code: string | null;
        title: string | null;
        factor_id: string | null;
      }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from("mitigation_items")
          .select("id, job_id, code, title, factor_id")
          .eq("organization_id", orgId)
          .gte("created_at", prevSince)
          .lt("created_at", prevUntil)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        return { data, error };
      });
      const prevList = (prevItems ?? []) as { id: string; job_id: string; code: string | null; title: string | null; factor_id: string | null }[];
      const prevJobIds = [...new Set(prevList.map((m) => m.job_id))];
      const prevJobMap = new Map<string, { risk_score: number | null; location: string }>();
      for (const idChunk of chunkArray(prevJobIds, 500)) {
        const { data: prevJobsData } = await supabase
          .from("jobs")
          .select("id, risk_score, location")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .in("id", idChunk);
        for (const j of prevJobsData ?? []) {
          const row = j as { id: string; risk_score: number | null; location: string | null };
          prevJobMap.set(row.id, { risk_score: row.risk_score, location: row.location ?? "unknown" });
        }
      }
      const prev: Record<string, CatStats> = {};
      for (const m of prevList) {
        const category = groupBy === "location" ? (prevJobMap.get(m.job_id)?.location ?? "unknown") : (m.code || m.factor_id || m.title || "unknown");
        if (!prev[category]) prev[category] = { count: 0, riskSum: 0, riskCount: 0 };
        prev[category].count += 1;
        const score = prevJobMap.get(m.job_id)?.risk_score;
        if (score != null) {
          prev[category].riskSum += score;
          prev[category].riskCount += 1;
        }
      }

      const itemsOut = Object.entries(current).map(([category, s]) => {
        const avg_risk = s.riskCount === 0 ? 0 : Math.round((s.riskSum / s.riskCount) * 100) / 100;
        const prevS = prev[category];
        const prevCount = prevS?.count ?? 0;
        const trend = prevCount === 0 ? (s.count > 0 ? "up" : "neutral") : s.count > prevCount ? "up" : s.count < prevCount ? "down" : "neutral";
        return { category, count: s.count, avg_risk, trend };
      });
      itemsOut.sort((a, b) => b.count - a.count);
      return res.json({ period: `${days}d`, groupBy, items: itemsOut.slice(0, 100) });
    } catch (error: any) {
      console.error("Analytics hazard-frequency error:", error);
      return res.status(500).json({ message: "Failed to fetch hazard frequency" });
    }
  }
);

// GET /api/analytics/compliance-rate — signature completion, photo upload, checklist completion, overall rate
analyticsRouter.get(
  "/compliance-rate",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({
        signatures: 0,
        photos: 0,
        checklists: 0,
        overall: 0,
        period: "30d",
        locked: true,
      });
    }
    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: jobList, error: jobsError } = await fetchAllPages<{ id: string }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from("jobs")
          .select("id")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .gte("created_at", since)
          .lte("created_at", until)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        return { data, error };
      });

      if (jobsError) throw jobsError;
      const jobIds = (jobList ?? []).map((j) => j.id);
      const totalJobs = jobIds.length;
      if (totalJobs === 0) {
        return res.json({
          period: `${days}d`,
          signatures: 0,
          photos: 0,
          checklists: 0,
          overall: 0,
        });
      }

      const jobsWithSignatureSet = new Set<string>();
      const jobsWithPhotoSet = new Set<string>();
      const mitigationList: { job_id: string; completed_at: string | null }[] = [];
      for (const idChunk of chunkArray(jobIds, 500)) {
        const [sigRes, photoRes, checklistRes] = await Promise.all([
          fetchAllPages<{ job_id: string }>(async (o, l) => {
            const { data, error } = await supabase
              .from("signatures")
              .select("job_id")
              .eq("organization_id", orgId)
              .in("job_id", idChunk)
              .order("signed_at", { ascending: false })
              .range(o, o + l - 1);
            return { data, error };
          }),
          fetchAllPages<{ job_id: string }>(async (o, l) => {
            const { data, error } = await supabase
              .from("documents")
              .select("job_id")
              .eq("organization_id", orgId)
              .eq("type", "photo")
              .in("job_id", idChunk)
              .order("created_at", { ascending: false })
              .range(o, o + l - 1);
            return { data, error };
          }),
          fetchAllPages<{ job_id: string; completed_at: string | null }>(async (o, l) => {
            const { data, error } = await supabase
              .from("mitigation_items")
              .select("job_id, completed_at")
              .eq("organization_id", orgId)
              .in("job_id", idChunk)
              .order("created_at", { ascending: false })
              .range(o, o + l - 1);
            return { data, error };
          }),
        ]);
        if (sigRes.error) throw sigRes.error;
        if (photoRes.error) throw photoRes.error;
        if (checklistRes.error) throw checklistRes.error;
        (sigRes.data ?? []).forEach((r) => jobsWithSignatureSet.add(r.job_id));
        (photoRes.data ?? []).forEach((r) => jobsWithPhotoSet.add(r.job_id));
        mitigationList.push(...(checklistRes.data ?? []));
      }
      // Per-job checklist: job is checklist-complete when all its mitigation items are completed (or it has none).
      const byJob: Record<string, { total: number; completed: number }> = {};
      for (const id of jobIds) byJob[id] = { total: 0, completed: 0 };
      for (const m of mitigationList) {
        if (!byJob[m.job_id]) continue;
        byJob[m.job_id].total += 1;
        if (m.completed_at) byJob[m.job_id].completed += 1;
      }
      const jobsWithChecklistComplete = jobIds.filter(
        (jid) => byJob[jid].total === 0 || byJob[jid].completed === byJob[jid].total
      ).length;
      const sigRate = totalJobs === 0 ? 0 : jobsWithSignatureSet.size / totalJobs;
      const photoRate = totalJobs === 0 ? 0 : jobsWithPhotoSet.size / totalJobs;
      const checklistRate = totalJobs === 0 ? 0 : jobsWithChecklistComplete / totalJobs;
      // Return percentages (0–100), not fractions: multiply by 100, then round; overall = average of percentage values
      const signatures = Math.round(sigRate * 10000) / 100;
      const photos = Math.round(photoRate * 10000) / 100;
      const checklists = Math.round(checklistRate * 10000) / 100;
      const overall =
        totalJobs === 0 ? 0 : Math.round(((signatures + photos + checklists) / 3) * 100) / 100;

      return res.json({
        period: `${days}d`,
        signatures,
        photos,
        checklists,
        overall,
      });
    } catch (error: any) {
      console.error("Analytics compliance-rate error:", error);
      return res.status(500).json({ message: "Failed to fetch compliance rate" });
    }
  }
);

// GET /api/analytics/job-completion — contract: completion_rate, avg_days, on_time_rate, overdue_count; optional: total, completed, period, avg_days_to_complete
// Server-side aggregate via get_job_completion_kpis RPC; period-scoped overdue_count + overdue_count_all_time.
analyticsRouter.get(
  "/job-completion",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({
        completion_rate: 0,
        avg_days: 0,
        on_time_rate: 0,
        overdue_count: 0,
        overdue_count_all_time: 0,
        total: 0,
        completed: 0,
        period: "30d",
        locked: true,
      });
    }
    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: kpiRows, error: rpcError } = await supabase.rpc("get_job_completion_kpis", {
        p_org_id: orgId,
        p_since: since,
        p_until: until,
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(kpiRows) ? kpiRows[0] : kpiRows;
      if (!row) {
        return res.json({
          completion_rate: 0,
          avg_days: 0,
          on_time_rate: 0,
          overdue_count: 0,
          overdue_count_all_time: 0,
          total: 0,
          completed: 0,
          period: `${days}d`,
          avg_days_to_complete: 0,
        });
      }
      const total = Number(row.total ?? 0);
      const completed = Number(row.completed ?? 0);
      const completion_rate = total === 0 ? 0 : Math.round((completed / total) * 10000) / 100;
      const avg_days_to_complete = Number(row.avg_days_to_complete ?? 0);
      const on_time_count = Number(row.on_time_count ?? 0);
      const on_time_rate = completed === 0 ? 0 : Math.round((on_time_count / completed) * 10000) / 100;
      const overdue_count = Number(row.overdue_count_period ?? 0);
      const overdue_count_all_time = Number(row.overdue_count_all_time ?? 0);

      return res.json({
        completion_rate,
        avg_days: avg_days_to_complete,
        on_time_rate,
        overdue_count,
        overdue_count_all_time,
        total,
        completed,
        period: `${days}d`,
        avg_days_to_complete,
      });
    } catch (error: any) {
      console.error("Analytics job-completion error:", error);
      return res.status(500).json({ message: "Failed to fetch job completion" });
    }
  }
);

// GET /api/analytics/insights — top 5 predictive insights (cached 1h)
analyticsRouter.get(
  "/insights",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({ insights: [], locked: true });
    }
    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const all = await getCachedInsights(orgId);
      const insights = all.slice(0, 5);
      return res.json({ insights });
    } catch (error: any) {
      console.error("Analytics insights error:", error);
      return res.status(500).json({ message: "Failed to fetch insights" });
    }
  }
);

analyticsRouter.get(
  "/mitigations",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    
    // Soft check: return empty analytics data if plan is inactive (better UX than 402)
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    
    if (!isActive || !hasAnalytics) {
      // Return empty analytics data instead of 402 (better UX)
      return res.json({
        org_id: authReq.user.organization_id,
        range_days: parseRangeDays(authReq.query.range as string | undefined),
        completion_rate: 0,
        avg_time_to_close_hours: 0,
        high_risk_jobs: 0,
        evidence_count: 0,
        jobs_with_evidence: 0,
        jobs_without_evidence: 0,
        avg_time_to_first_evidence_hours: 0,
        trend: [],
        jobs_total: 0,
        jobs_scored: 0,
        jobs_with_any_evidence: 0,
        jobs_with_photo_evidence: 0,
        jobs_missing_required_evidence: 0,
        required_evidence_policy: null,
        avg_time_to_first_photo_minutes: null,
        trend_empty_reason: 'no_jobs',
        locked: true,
        message: status === "none" 
          ? "Analytics requires an active subscription"
          : "Analytics not available on your current plan",
      });
    }
    
    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) {
        return res.status(400).json({ message: "Missing organization id" });
      }

      const rangeDays = parseRangeDays(authReq.query.range as string | undefined);
      const crewId = authReq.query.crew_id
        ? String(authReq.query.crew_id)
        : undefined;

      const sinceDate = new Date();
      sinceDate.setHours(0, 0, 0, 0);
      sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1));
      const sinceIso = sinceDate.toISOString();

      // When crew_id is supplied, scope jobs to those that have mitigation activity by this crew (denominators consistent with crew filter).
      let jobIdsFilter: string[] | null = null;
      if (crewId) {
        const { data: crewMitigationRows } = await fetchAllPages<{ job_id: string }>(
          async (offset, limit) => {
            const { data, error } = await supabase
              .from("mitigation_items")
              .select("job_id")
              .eq("organization_id", orgId)
              .eq("completed_by", crewId)
              .or(`created_at.gte.${sinceIso},completed_at.gte.${sinceIso}`)
              .range(offset, offset + limit - 1);
            return { data, error };
          }
        );
        const crewJobIdsSet = new Set((crewMitigationRows ?? []).map((r) => r.job_id));
        jobIdsFilter = crewJobIdsSet.size > 0 ? [...crewJobIdsSet] : [];
      }

      let jobs: JobRecord[];
      if (jobIdsFilter !== null) {
        if (jobIdsFilter.length === 0) {
          jobs = [];
        } else {
          const jobsList: JobRecord[] = [];
          for (const idChunk of chunkArray(jobIdsFilter, 500)) {
            const { data, error } = await supabase
              .from("jobs")
              .select("id, risk_score, created_at")
              .eq("organization_id", orgId)
              .is("deleted_at", null)
              .in("id", idChunk);
            if (error) throw error;
            jobsList.push(...((data as JobRecord[]) ?? []));
          }
          jobs = jobsList;
        }
      } else {
        const { data: jobsData, error: jobsError } = await fetchAllPages<JobRecord>(
          async (offset, limit) => {
            const { data, error } = await supabase
              .from("jobs")
              .select("id, risk_score, created_at")
              .eq("organization_id", orgId)
              .is("deleted_at", null)
              .gte("created_at", sinceIso)
              .order("created_at", { ascending: true })
              .range(offset, offset + limit - 1);
            return { data, error };
          }
        );
        if (jobsError) throw jobsError;
        jobs = jobsData ?? [];
      }
      const jobIds = jobs.map((j) => j.id);

      if (jobIds.length === 0) {
        return res.json({
          org_id: orgId,
          range_days: rangeDays,
          completion_rate: 0,
          avg_time_to_close_hours: 0,
          high_risk_jobs: 0,
          evidence_count: 0,
          jobs_with_evidence: 0,
          jobs_without_evidence: 0,
          avg_time_to_first_evidence_hours: 0,
          trend: [],
          jobs_total: 0,
          jobs_scored: 0,
          jobs_with_any_evidence: 0,
          jobs_with_photo_evidence: 0,
          jobs_missing_required_evidence: 0,
          required_evidence_policy: "Photo required for high-risk jobs",
          avg_time_to_first_photo_minutes: null,
          trend_empty_reason: "no_jobs",
        });
      }

      const mitigationsByChunk = chunkArray(jobIds, 500);
      const mitigationsRaw: MitigationItem[] = [];
      for (const ids of mitigationsByChunk) {
        const { data, error } = await fetchAllPages<MitigationItem>(async (offset, limit) => {
          let query = supabase
            .from("mitigation_items")
            .select("id, job_id, created_at, completed_at, completed_by")
            .eq("organization_id", orgId)
            .in("job_id", ids);
          if (crewId) {
            query = query
              .gte("created_at", sinceIso)
              .or(`completed_at.is.null,completed_at.gte.${sinceIso}`);
          }
          const { data, error } = await query
            .order("created_at", { ascending: true })
            .range(offset, offset + limit - 1);
          return { data, error };
        });
        if (error) throw error;
        mitigationsRaw.push(...(data ?? []));
      }

      const documentsByChunk = chunkArray(jobIds, 500);
      const documentsRaw: DocumentRecord[] = [];
      for (const ids of documentsByChunk) {
        const { data, error } = await fetchAllPages<DocumentRecord>(async (offset, limit) => {
          let query = supabase
            .from("documents")
            .select("id, job_id, created_at, type")
            .eq("organization_id", orgId)
            .in("job_id", ids);
          if (crewId) {
            query = query.gte("created_at", sinceIso);
          }
          const { data, error } = await query
            .order("created_at", { ascending: true })
            .range(offset, offset + limit - 1);
          return { data, error };
        });
        if (error) throw error;
        documentsRaw.push(...(data ?? []));
      }

      const mitigations = mitigationsRaw.filter((item) => {
        if (!crewId) return true;
        return item.completed_by === crewId;
      });

      const documents = documentsRaw;

      const totalMitigations = mitigations.length;
      const completedMitigations = mitigations.filter(
        (item) => item.completed_at
      );

      const completionRate =
        totalMitigations === 0
          ? 0
          : completedMitigations.length / totalMitigations;

      const avgTimeToCloseHours =
        completedMitigations.length === 0
          ? 0
          : completedMitigations.reduce((acc, item) => {
              const createdAt = new Date(item.created_at).getTime();
              const completedAt = new Date(item.completed_at as string).getTime();
              const diffHours = (completedAt - createdAt) / (1000 * 60 * 60);
              return acc + Math.max(diffHours, 0);
            }, 0) / completedMitigations.length;

      const highRiskJobs = (jobs || []).filter((job) => {
        if (job.risk_score === null || job.risk_score === undefined) {
          return false;
        }
        return job.risk_score >= 70;
      }).length;

      const evidenceCount = documents.length;

      const jobEvidenceMap = documents.reduce<Record<string, string>>((acc, doc) => {
        if (!acc[doc.job_id] || new Date(doc.created_at) < new Date(acc[doc.job_id])) {
          acc[doc.job_id] = doc.created_at;
        }
        return acc;
      }, {});

      const jobsWithEvidence = Object.keys(jobEvidenceMap).length;
      const jobsWithoutEvidence = Math.max(jobIds.length - jobsWithEvidence, 0);

      // Photo evidence: only documents with type === "photo"
      const photoDocuments = documents.filter((d) => (d as DocumentRecord).type === "photo");
      const jobPhotoMap = photoDocuments.reduce<Record<string, string>>((acc, doc) => {
        if (!acc[doc.job_id] || new Date(doc.created_at) < new Date(acc[doc.job_id])) {
          acc[doc.job_id] = doc.created_at;
        }
        return acc;
      }, {});
      const jobsWithPhotoEvidence = Object.keys(jobPhotoMap).length;

      // Calculate explicit evidence metrics
      const jobsTotal = jobIds.length;
      
      // Jobs missing required evidence: high-risk jobs without photo evidence (policy: photo required)
      const highRiskJobIds = (jobs || [])
        .filter((job) => job.risk_score !== null && job.risk_score >= 70)
        .map((job) => job.id);
      const highRiskJobsWithoutPhotoEvidence = highRiskJobIds.filter(
        (jobId) => !jobPhotoMap[jobId]
      ).length;
      const jobsMissingRequiredEvidence = highRiskJobsWithoutPhotoEvidence;

      const avgTimeToFirstEvidenceHours =
        jobsWithEvidence === 0
          ? 0
          : Object.entries(jobEvidenceMap).reduce((acc, [jobId, firstEvidence]) => {
              const job = jobs?.find((item) => item.id === jobId);
              if (!job) return acc;
              const jobCreated = new Date(job.created_at).getTime();
              const evidenceCreated = new Date(firstEvidence).getTime();
              const diffHours = (evidenceCreated - jobCreated) / (1000 * 60 * 60);
              return acc + Math.max(diffHours, 0);
            }, 0) / jobsWithEvidence;
      
      const avgTimeToFirstPhotoMinutes =
        jobsWithPhotoEvidence === 0
          ? 0
          : Object.entries(jobPhotoMap).reduce((acc, [jobId, firstPhotoAt]) => {
              const job = jobs?.find((item) => item.id === jobId);
              if (!job) return acc;
              const jobCreated = new Date(job.created_at).getTime();
              const photoCreated = new Date(firstPhotoAt).getTime();
              const diffMinutes = (photoCreated - jobCreated) / (1000 * 60);
              return acc + Math.max(diffMinutes, 0);
            }, 0) / jobsWithPhotoEvidence;

      // Trend (daily)
      const trend: { date: string; completion_rate: number }[] = [];
      const dateCursor = new Date(sinceDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      while (dateCursor <= today) {
        const dateKey = dateCursor.toISOString().slice(0, 10);
        const itemsForDay = mitigations.filter(
          (item) => toDateKey(item.created_at) === dateKey
        );
        const dayCompleted = itemsForDay.filter((item) => {
          if (!item.completed_at) return false;
          return toDateKey(item.completed_at) === dateKey;
        });

        const dayRate =
          itemsForDay.length === 0
            ? 0
            : dayCompleted.length / itemsForDay.length;

        trend.push({
          date: dateKey,
          completion_rate: Number(dayRate.toFixed(3)),
        });

        dateCursor.setDate(dateCursor.getDate() + 1);
      }

      // Determine empty reasons
      const trendEmptyReason = jobsTotal === 0 
        ? 'no_jobs' 
        : totalMitigations === 0 
        ? 'no_events' 
        : null;

      res.json({
        org_id: orgId,
        range_days: rangeDays,
        completion_rate: Number(completionRate.toFixed(3)),
        avg_time_to_close_hours: Number(avgTimeToCloseHours.toFixed(2)),
        high_risk_jobs: highRiskJobs,
        evidence_count: evidenceCount,
        jobs_with_evidence: jobsWithEvidence,
        jobs_without_evidence: jobsWithoutEvidence,
        avg_time_to_first_evidence_hours: Number(avgTimeToFirstEvidenceHours.toFixed(2)),
        trend,
        // Explicit evidence denominators
        jobs_total: jobsTotal,
        jobs_scored: (jobs || []).filter((job) => job.risk_score !== null).length,
        jobs_with_any_evidence: jobsWithEvidence,
        jobs_with_photo_evidence: jobsWithPhotoEvidence,
        jobs_missing_required_evidence: jobsMissingRequiredEvidence,
        required_evidence_policy: 'Photo required for high-risk jobs',
        avg_time_to_first_photo_minutes: Math.round(avgTimeToFirstPhotoMinutes),
        // Empty state reasons
        trend_empty_reason: trendEmptyReason,
      });
    } catch (error: any) {
      console.error("Analytics metrics error:", error);
      res.status(500).json({ message: "Failed to fetch analytics metrics" });
    }
  }
);

// GET /api/analytics/summary
// Returns job counts by status, risk level distribution, evidence statistics, team activity
// Spec: 10.2 Analytics API - summary endpoint
type JobSummaryRecord = {
  id: string;
  status: string | null;
  risk_level: string | null;
  created_at: string;
};

analyticsRouter.get(
  "/summary",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;

    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);

    if (!isActive || !hasAnalytics) {
      return res.json({
        org_id: authReq.user.organization_id ?? "",
        range_days: parseRangeDays(authReq.query.range as string | undefined),
        job_counts_by_status: {} as Record<string, number>,
        risk_level_distribution: {} as Record<string, number>,
        evidence_statistics: {
          total_items: 0,
          jobs_with_evidence: 0,
          jobs_without_evidence: 0,
        },
        team_activity: [],
        locked: true,
        message:
          status === "none"
            ? "Analytics requires an active subscription"
            : "Analytics not available on your current plan",
      });
    }

    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) {
        return res.status(400).json({ message: "Missing organization id" });
      }

      const rangeDays = parseRangeDays(authReq.query.range as string | undefined);
      const sinceDate = new Date();
      sinceDate.setHours(0, 0, 0, 0);
      sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1));
      const sinceIso = sinceDate.toISOString();

      const { data: jobs, error: jobsError } = await fetchAllPages<JobSummaryRecord>(async (offset, limit) => {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, status, risk_level, created_at")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        return { data, error };
      });

      if (jobsError) throw jobsError;

      const jobList = (jobs ?? []) as JobSummaryRecord[];
      const jobIds = jobList.map((j) => j.id);

      const documents: { job_id: string }[] = [];
      const completions: { job_id: string; completed_by: string | null }[] = [];
      for (const idChunk of chunkArray(jobIds, 500)) {
        const [docRes, mitRes] = await Promise.all([
          fetchAllPages<{ job_id: string }>(async (o, l) => {
            const { data, error } = await supabase
              .from("documents")
              .select("id, job_id")
              .eq("organization_id", orgId)
              .in("job_id", idChunk)
              .order("created_at", { ascending: false })
              .range(o, o + l - 1);
            return { data, error };
          }),
          fetchAllPages<{ job_id: string; completed_by: string | null }>(async (o, l) => {
            const { data, error } = await supabase
              .from("mitigation_items")
              .select("id, job_id, completed_at, completed_by")
              .eq("organization_id", orgId)
              .in("job_id", idChunk)
              .not("completed_at", "is", null)
              .gte("completed_at", sinceIso)
              .order("created_at", { ascending: false })
              .range(o, o + l - 1);
            return { data, error };
          }),
        ]);
        if (docRes.error) throw docRes.error;
        if (mitRes.error) throw mitRes.error;
        documents.push(...(docRes.data ?? []));
        completions.push(...(mitRes.data ?? []));
      }

      const jobCountsByStatus: Record<string, number> = {};
      for (const job of jobList) {
        const s = job.status ?? "unknown";
        jobCountsByStatus[s] = (jobCountsByStatus[s] ?? 0) + 1;
      }

      const riskLevelDistribution: Record<string, number> = {};
      for (const job of jobList) {
        const level = (job.risk_level ?? "unscored").toLowerCase();
        riskLevelDistribution[level] = (riskLevelDistribution[level] ?? 0) + 1;
      }

      const jobsWithEvidenceSet = new Set(
        documents.map((d) => d.job_id).filter(Boolean)
      );
      const jobsWithEvidence = jobsWithEvidenceSet.size;
      const jobsWithoutEvidence = Math.max(jobIds.length - jobsWithEvidence, 0);

      const evidenceStatistics = {
        total_items: documents.length,
        jobs_with_evidence: jobsWithEvidence,
        jobs_without_evidence: jobsWithoutEvidence,
      };

      const completionsByUser: Record<string, number> = {};
      for (const c of completions) {
        const uid = c.completed_by ?? "unknown";
        completionsByUser[uid] = (completionsByUser[uid] ?? 0) + 1;
      }
      const teamActivity = Object.entries(completionsByUser)
        .filter(([id]) => id !== "unknown")
        .map(([user_id, completions_count]) => ({ user_id, completions_count }))
        .sort((a, b) => b.completions_count - a.completions_count)
        .slice(0, 20);

      res.json({
        org_id: orgId,
        range_days: rangeDays,
        job_counts_by_status: jobCountsByStatus,
        risk_level_distribution: riskLevelDistribution,
        evidence_statistics: evidenceStatistics,
        team_activity: teamActivity,
      });
    } catch (error: any) {
      console.error("Analytics summary error:", error);
      res.status(500).json({ message: "Failed to fetch analytics summary" });
    }
  }
);

