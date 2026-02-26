import express, { type Router as ExpressRouter } from "express";
import { supabase } from "../lib/supabaseClient";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import { requireFeature } from "../middleware/limits";
import { generateInsights } from "../services/insights";

export const analyticsRouter: ExpressRouter = express.Router();

// In-memory cache for insights: 1h TTL per org
const INSIGHTS_CACHE_TTL_MS = 60 * 60 * 1000;
const insightsCache = new Map<string, { data: ReturnType<typeof generateInsights> extends Promise<infer T> ? T : never; expires: number }>();
let insightsCacheHits = 0;
let insightsCacheMisses = 0;

async function getCachedInsights(orgId: string) {
  const entry = insightsCache.get(orgId);
  if (entry && Date.now() < entry.expires) {
    insightsCacheHits += 1;
    return entry.data;
  }
  insightsCacheMisses += 1;
  const data = await generateInsights(orgId);
  insightsCache.set(orgId, { data, expires: Date.now() + INSIGHTS_CACHE_TTL_MS });
  return data;
}

/** Analytics observability: cache hit rates and entry count for metrics endpoint. */
export function getAnalyticsObservability(): {
  insights_cache: { hits: number; misses: number; hit_rate: number; entries: number };
} {
  const total = insightsCacheHits + insightsCacheMisses;
  const hit_rate = total === 0 ? 0 : Math.round((insightsCacheHits / total) * 10000) / 100;
  return {
    insights_cache: {
      hits: insightsCacheHits,
      misses: insightsCacheMisses,
      hit_rate,
      entries: insightsCache.size,
    },
  };
}

const PAGE_SIZE = 500;

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

// Fallback refresh when pg_cron is unavailable: refresh MV at most once per hour before serving week/month trends
const ANALYTICS_MV_REFRESH_COOLDOWN_MS = 60 * 60 * 1000;
let lastAnalyticsMvRefreshAt = 0;

async function ensureAnalyticsMvRefreshed(): Promise<void> {
  const now = Date.now();
  if (now - lastAnalyticsMvRefreshAt < ANALYTICS_MV_REFRESH_COOLDOWN_MS) return;
  lastAnalyticsMvRefreshAt = now;
  const { error } = await supabase.rpc("refresh_analytics_weekly_job_stats");
  if (error) {
    console.warn("Analytics MV refresh failed (pg_cron may be unavailable):", error);
  }
}

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
      const periodLabel = periodKey === "1y" ? "1y" : `${days}d`;

      // Day grouping: SQL aggregation only — RPC returns { period_key, value } per bucket (no full job fetch)
      if (groupBy === "day") {
        const { data: dayRows, error: dayError } = await supabase.rpc("get_trends_day_buckets", {
          p_org_id: orgId,
          p_since: since,
          p_until: until,
          p_metric: metric,
        });
        if (!dayError && dayRows && Array.isArray(dayRows)) {
          const dayPoints: Point[] = (dayRows as { period_key: string; value: number }[]).map((r) => {
            const periodStr = typeof r.period_key === "string" ? r.period_key.slice(0, 10) : new Date(r.period_key).toISOString().slice(0, 10);
            const raw = Number(r.value ?? 0);
            // Completion: RPC returns rate 0–100 for day; clamp for safety. Other metrics use raw.
            const value = metric === "completion" ? Math.min(100, Math.max(0, raw)) : raw;
            return { period: periodStr, value, label: periodStr };
          });
          return res.json({ period: periodLabel, groupBy, metric, data: dayPoints });
        }
        // RPC missing or failed: return empty set instead of 500
        if (dayError) {
          console.warn("Analytics trends day buckets RPC failed, returning empty data:", dayError);
          return res.json({ period: periodLabel, groupBy, metric, data: [] });
        }
      }

      // Compliance trend (week/month): SQL-side aggregation only
      if (metric === "compliance") {
        const { data: complianceRows, error: complianceError } = await supabase.rpc("get_trends_compliance_buckets", {
          p_org_id: orgId,
          p_since: since,
          p_until: until,
          p_group_by: groupBy,
        });
        if (!complianceError && complianceRows && Array.isArray(complianceRows)) {
          const compPoints: Point[] = (complianceRows as { period_key: string; total: number; with_signature: number; with_photo: number; checklist_complete: number }[]).map((r) => {
            const total = Number(r.total ?? 0);
            const sigRate = total === 0 ? 0 : Number(r.with_signature ?? 0) / total;
            const photoRate = total === 0 ? 0 : Number(r.with_photo ?? 0) / total;
            const checklistRate = total === 0 ? 0 : Number(r.checklist_complete ?? 0) / total;
            const valuePct = total === 0 ? 0 : Math.round(((sigRate + photoRate + checklistRate) / 3) * 10000) / 100;
            const periodStr = typeof r.period_key === "string" ? r.period_key.slice(0, 10) : new Date(r.period_key).toISOString().slice(0, 10);
            return { period: periodStr, value: valuePct, label: periodStr };
          });
          return res.json({ period: periodLabel, groupBy, metric, data: compPoints });
        }
        if (complianceError) throw complianceError;
      }

      const useMv = (groupBy === "week" || groupBy === "month") && days <= MV_COVERAGE_DAYS && metric !== "compliance";

      if (useMv) {
        await ensureAnalyticsMvRefreshed();
        const sinceWeek = weekStart(new Date(since));
        const untilWeek = weekStart(new Date(until));

        // Completion trend (week/month): completion counts from analytics_weekly_completion_stats (keyed by completion week);
        // jobs_created from analytics_weekly_job_stats (creation week) for rate denominator. Completion rates reflect completions in the charted period.
        if (metric === "completion") {
          const [completionRes, creationRes] = await Promise.all([
            fetchAllPages<{ week_start: string; jobs_completed: number }>(async (offset, limit) => {
              const { data, error } = await supabase
                .from("analytics_weekly_completion_stats")
                .select("week_start, jobs_completed")
                .eq("organization_id", orgId)
                .gte("week_start", sinceWeek)
                .lte("week_start", untilWeek)
                .order("week_start", { ascending: true })
                .range(offset, offset + limit - 1);
              return { data, error };
            }),
            fetchAllPages<{ week_start: string; jobs_created: number }>(async (offset, limit) => {
              const { data, error } = await supabase
                .from("analytics_weekly_job_stats")
                .select("week_start, jobs_created")
                .eq("organization_id", orgId)
                .gte("week_start", sinceWeek)
                .lte("week_start", untilWeek)
                .order("week_start", { ascending: true })
                .range(offset, offset + limit - 1);
              return { data, error };
            }),
          ]);
          if (!completionRes.error && !creationRes.error) {
            const completionRows = (completionRes.data ?? []) as { week_start: string; jobs_completed: number }[];
            const creationRows = (creationRes.data ?? []) as { week_start: string; jobs_created: number }[];
            const createdByWeek = new Map<string, number>();
            const completedByWeek = new Map<string, number>();
            for (const r of creationRows) {
              const w = typeof r.week_start === "string" ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10);
              createdByWeek.set(w, (createdByWeek.get(w) ?? 0) + Number(r.jobs_created ?? 0));
            }
            for (const r of completionRows) {
              const w = typeof r.week_start === "string" ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10);
              completedByWeek.set(w, (completedByWeek.get(w) ?? 0) + Number(r.jobs_completed ?? 0));
            }
            if (groupBy === "week") {
              const allWeeks = [...new Set([...createdByWeek.keys(), ...completedByWeek.keys()])].sort();
              for (const period of allWeeks) {
                const created = createdByWeek.get(period) ?? 0;
                const completed = completedByWeek.get(period) ?? 0;
                const ratePct = created === 0 ? 0 : (completed / created) * 100;
                const value = Math.min(100, Math.max(0, Math.round(ratePct * 100) / 100));
                points.push({ period, value, label: period });
              }
            } else {
              const byMonth = new Map<string, { created: number; completed: number }>();
              for (const r of completionRows) {
                const period = monthStart(new Date(typeof r.week_start === "string" ? r.week_start : String(r.week_start)));
                const cur = byMonth.get(period) ?? { created: 0, completed: 0 };
                cur.completed += Number(r.jobs_completed ?? 0);
                byMonth.set(period, cur);
              }
              for (const r of creationRows) {
                const period = monthStart(new Date(typeof r.week_start === "string" ? r.week_start : String(r.week_start)));
                const cur = byMonth.get(period) ?? { created: 0, completed: 0 };
                cur.created += Number(r.jobs_created ?? 0);
                byMonth.set(period, cur);
              }
              for (const [period] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
                const { created, completed } = byMonth.get(period)!;
                const ratePct = created === 0 ? 0 : (completed / created) * 100;
                const value = Math.min(100, Math.max(0, Math.round(ratePct * 100) / 100));
                points.push({ period, value, label: period });
              }
            }
            if (points.length > 0) return res.json({ period: periodLabel, groupBy, metric, data: points });
          }
          if (completionRes.error) throw completionRes.error;
          if (creationRes.error) throw creationRes.error;
        }

        const { data: mvRows, error: mvError } = await fetchAllPages<{
          week_start: string;
          jobs_created: number;
          avg_risk: number | null;
        }>(async (offset, limit) => {
          const { data, error } = await supabase
            .from("analytics_weekly_job_stats")
            .select("week_start, jobs_created, avg_risk")
            .eq("organization_id", orgId)
            .gte("week_start", sinceWeek)
            .lte("week_start", untilWeek)
            .order("week_start", { ascending: true })
            .range(offset, offset + limit - 1);
          return { data, error };
        });

        if (!mvError && mvRows && mvRows.length > 0) {
          const rows = mvRows as { week_start: string; jobs_created: number; avg_risk: number | null }[];
          if (groupBy === "week") {
            for (const r of rows) {
              const period = typeof r.week_start === "string" ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10);
              let value = 0;
              if (metric === "jobs") value = r.jobs_created ?? 0;
              else if (metric === "risk") value = r.avg_risk != null ? Math.round(r.avg_risk * 100) / 100 : 0;
              points.push({ period, value, label: period });
            }
          } else {
            const byMonth = new Map<string, { jobs_created: number; riskSum: number; riskWeight: number }>();
            for (const r of rows) {
              const period = monthStart(new Date(typeof r.week_start === "string" ? r.week_start : String(r.week_start)));
              const cur = byMonth.get(period) ?? { jobs_created: 0, riskSum: 0, riskWeight: 0 };
              cur.jobs_created += r.jobs_created ?? 0;
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
              points.push({ period, value, label: period });
            }
          }
          return res.json({ period: periodLabel, groupBy, metric, data: points });
        }
      }

      const { data: jobs, error: jobsError } = await fetchAllPages<{
        id: string;
        risk_score: number | null;
        status: string | null;
        created_at: string;
        completed_at: string | null;
      }>(async (offset, limit) => {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, risk_score, status, created_at, completed_at")
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .gte("created_at", since)
          .lte("created_at", until)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        return { data, error };
      });

      if (jobsError) throw jobsError;
      const jobList = (jobs || []) as {
        id: string;
        risk_score: number | null;
        status: string | null;
        created_at: string;
        completed_at: string | null;
      }[];

      const getBucketKey = (date: Date) =>
        groupBy === "month" ? monthStart(date) : groupBy === "week" ? weekStart(date) : toDateKey(date.toISOString());

      const bucketValues = new Map<string, number>();
      const bucketRiskSums = new Map<string, { sum: number; count: number }>();
      // Completion (fallback): bucket by creation; value = (jobs_completed / jobs_created) * 100, 0–100
      const bucketCompleted = new Map<string, number>();

      for (const j of jobList) {
        const keyCreated = getBucketKey(new Date(j.created_at));
        const completed = j.status?.toLowerCase() === "completed";

        if (metric === "completion") {
          bucketValues.set(keyCreated, (bucketValues.get(keyCreated) ?? 0) + 1);
          if (completed) {
            bucketCompleted.set(keyCreated, (bucketCompleted.get(keyCreated) ?? 0) + 1);
          }
        } else if (metric === "jobs") {
          bucketValues.set(keyCreated, (bucketValues.get(keyCreated) ?? 0) + 1);
        } else if (metric === "risk" && j.risk_score != null) {
          const cur = bucketRiskSums.get(keyCreated) ?? { sum: 0, count: 0 };
          cur.sum += j.risk_score;
          cur.count += 1;
          bucketRiskSums.set(keyCreated, cur);
        }
      }

      if (metric === "completion") {
        for (const period of [...bucketValues.keys()].sort((a, b) => a.localeCompare(b))) {
          const created = bucketValues.get(period) ?? 0;
          const completed = bucketCompleted.get(period) ?? 0;
          const rate = created === 0 ? 0 : (completed / created) * 100;
          const value = Math.min(100, Math.max(0, Math.round(rate * 100) / 100));
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

      return res.json({ period: periodLabel, groupBy, metric, data: points });
    } catch (error: any) {
      console.error("Analytics trends error:", error);
      return res.status(500).json({ message: "Failed to fetch analytics trends" });
    }
  }
);

// GET /api/analytics/risk-heatmap — SQL-side aggregation by job_type and day_of_week
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

      const { data: rows, error } = await supabase.rpc("get_risk_heatmap_buckets", {
        p_org_id: orgId,
        p_since: since,
        p_until: until,
      });
      if (error) throw error;
      const list = (Array.isArray(rows) ? rows : []) as { job_type: string; day_of_week: number; avg_risk: number; count: number }[];
      const buckets = list.map((r) => ({
        job_type: r.job_type ?? "other",
        day_of_week: Number(r.day_of_week ?? 0),
        avg_risk: Number(r.avg_risk ?? 0),
        count: Number(r.count ?? 0),
      }));
      return res.json({ period: `${days}d`, buckets });
    } catch (error: any) {
      console.error("Analytics risk-heatmap error:", error);
      return res.status(500).json({ message: "Failed to fetch risk heatmap" });
    }
  }
);

// GET /api/analytics/team-performance — jobs_assigned, jobs_completed, completion_rate, avg_days, overdue_count per user
// Server-side aggregate via get_team_performance_kpis RPC; jobs_assigned is period-scoped (completed in period + open jobs created in period).
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
          jobs_assigned === 0 ? 0 : Math.min(100, Math.max(0, Math.round((jobs_completed / jobs_assigned) * 10000) / 100));
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
      const userIds = members.map((m) => m.user_id);
      const userMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: userRows } = await supabase
          .from("users")
          .select("id, full_name")
          .eq("organization_id", orgId)
          .in("id", userIds);
        for (const u of userRows || []) {
          const name = (u as { id: string; full_name: string | null }).full_name ?? "";
          userMap.set((u as { id: string }).id, name.trim() || "Unknown");
        }
      }
      const membersWithNames = members.map((m) => ({
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

// GET /api/analytics/hazard-frequency — SQL-side aggregation by type|location, trend vs previous window
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

      const prevUntil = since;
      const prevSince = new Date(new Date(since).getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows, error } = await supabase.rpc("get_hazard_frequency_buckets", {
        p_org_id: orgId,
        p_since: since,
        p_until: until,
        p_prev_since: prevSince,
        p_prev_until: prevUntil,
        p_group_by: groupBy,
      });
      if (error) throw error;
      const list = (Array.isArray(rows) ? rows : []) as { category: string; count: number; avg_risk: number; prev_count: number }[];
      const itemsOut = list.map((r) => {
        const count = Number(r.count ?? 0);
        const prevCount = Number(r.prev_count ?? 0);
        const trend =
          prevCount === 0 ? (count > 0 ? "up" : "neutral") : count > prevCount ? "up" : count < prevCount ? "down" : "neutral";
        return {
          category: r.category ?? "unknown",
          count,
          avg_risk: Number(r.avg_risk ?? 0),
          trend,
        };
      });
      return res.json({ period: `${days}d`, groupBy, items: itemsOut.slice(0, 100) });
    } catch (error: any) {
      console.error("Analytics hazard-frequency error:", error);
      return res.status(500).json({ message: "Failed to fetch hazard frequency" });
    }
  }
);

// GET /api/analytics/compliance-rate — SQL-side aggregation: signature, photo, checklist, overall (0–100)
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

      const { data: kpiRows, error: rpcError } = await supabase.rpc("get_compliance_rate_kpis", {
        p_org_id: orgId,
        p_since: since,
        p_until: until,
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(kpiRows) ? kpiRows[0] : kpiRows;
      const totalJobs = Number(row?.total_jobs ?? 0);
      if (totalJobs === 0) {
        return res.json({
          period: `${days}d`,
          signatures: 0,
          photos: 0,
          checklists: 0,
          overall: 0,
        });
      }
      const withSig = Number(row?.jobs_with_signature ?? 0);
      const withPhoto = Number(row?.jobs_with_photo ?? 0);
      const checklistComplete = Number(row?.jobs_checklist_complete ?? 0);
      const signatures = Math.round((withSig / totalJobs) * 10000) / 100;
      const photos = Math.round((withPhoto / totalJobs) * 10000) / 100;
      const checklists = Math.round((checklistComplete / totalJobs) * 10000) / 100;
      const overall = Math.round(((signatures + photos + checklists) / 3) * 100) / 100;

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
      const completion_rate =
        total === 0 ? 0 : Math.min(100, Math.max(0, Math.round((completed / total) * 10000) / 100));
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

// GET /api/analytics/mitigations — server-side aggregation via get_mitigations_analytics_kpis + get_mitigations_analytics_trend
analyticsRouter.get(
  "/mitigations",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;

    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);

    if (!isActive || !hasAnalytics) {
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
        trend_empty_reason: "no_jobs",
        locked: true,
        message:
          status === "none"
            ? "Analytics requires an active subscription"
            : "Analytics not available on your current plan",
      });
    }

    try {
      const orgId = authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });

      const rangeDays = parseRangeDays(authReq.query.range as string | undefined);
      const crewId = authReq.query.crew_id ? String(authReq.query.crew_id) : undefined;
      const { since, until } = dateRangeForDays(rangeDays);

      const [kpisRes, trendRes] = await Promise.all([
        supabase.rpc("get_mitigations_analytics_kpis", {
          p_org_id: orgId,
          p_since: since,
          p_until: until,
          p_crew_id: crewId ?? null,
        }),
        supabase.rpc("get_mitigations_analytics_trend", {
          p_org_id: orgId,
          p_since: since,
          p_until: until,
          p_crew_id: crewId ?? null,
        }),
      ]);

      if (kpisRes.error) throw kpisRes.error;
      if (trendRes.error) throw trendRes.error;

      const kpiRow = Array.isArray(kpisRes.data) ? kpisRes.data[0] : kpisRes.data;
      const trendRows = (Array.isArray(trendRes.data) ? trendRes.data : []) as { period_key: string | Date; completion_rate: number }[];

      const jobsTotal = Number(kpiRow?.jobs_total ?? 0);
      const jobsWithEvidence = Number(kpiRow?.jobs_with_evidence ?? 0);
      const totalMitigations =
        Number(kpiRow?.jobs_with_evidence ?? 0) + Number(kpiRow?.jobs_without_evidence ?? 0);
      const trendEmptyReason =
        jobsTotal === 0 ? "no_jobs" : (trendRows.length === 0 ? "no_events" : null);

      const trendByDate = new Map<string, number>();
      for (const r of trendRows) {
        const dateStr =
          typeof r.period_key === "string"
            ? r.period_key.slice(0, 10)
            : new Date(r.period_key).toISOString().slice(0, 10);
        trendByDate.set(dateStr, Number(r.completion_rate ?? 0));
      }
      const trend: { date: string; completion_rate: number }[] = [];
      const cursor = new Date(since);
      cursor.setHours(0, 0, 0, 0);
      const end = new Date(until);
      end.setHours(23, 59, 59, 999);
      while (cursor <= end) {
        const dateStr = cursor.toISOString().slice(0, 10);
        trend.push({ date: dateStr, completion_rate: trendByDate.get(dateStr) ?? 0 });
        cursor.setDate(cursor.getDate() + 1);
      }

      res.json({
        org_id: orgId,
        range_days: rangeDays,
        completion_rate: Number(kpiRow?.completion_rate ?? 0),
        avg_time_to_close_hours: Number(kpiRow?.avg_time_to_close_hours ?? 0),
        high_risk_jobs: Number(kpiRow?.high_risk_jobs ?? 0),
        evidence_count: Number(kpiRow?.evidence_count ?? 0),
        jobs_with_evidence: jobsWithEvidence,
        jobs_without_evidence: Number(kpiRow?.jobs_without_evidence ?? 0),
        avg_time_to_first_evidence_hours: Number(kpiRow?.avg_time_to_first_evidence_hours ?? 0),
        trend,
        jobs_total: jobsTotal,
        jobs_scored: Number(kpiRow?.jobs_scored ?? 0),
        jobs_with_any_evidence: Number(kpiRow?.jobs_with_any_evidence ?? 0),
        jobs_with_photo_evidence: Number(kpiRow?.jobs_with_photo_evidence ?? 0),
        jobs_missing_required_evidence: Number(kpiRow?.jobs_missing_required_evidence ?? 0),
        required_evidence_policy: "Photo required for high-risk jobs",
        avg_time_to_first_photo_minutes:
          kpiRow?.avg_time_to_first_photo_minutes != null
            ? Math.round(Number(kpiRow.avg_time_to_first_photo_minutes))
            : null,
        trend_empty_reason: trendEmptyReason,
      });
    } catch (error: any) {
      console.error("Analytics mitigations error:", error);
      res.status(500).json({ message: "Failed to fetch analytics mitigations" });
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
              .gte("created_at", sinceIso)
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

