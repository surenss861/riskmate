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
};

const MAX_FETCH_LIMIT = 10000;

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

// --- Period parsing for analytics (7d, 30d, 90d) ---
const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;
type PeriodKey = keyof typeof PERIOD_DAYS;

const parsePeriod = (value?: string | string[]): { days: number; key: PeriodKey } => {
  const str = value ? (Array.isArray(value) ? value[0] : value) : "30d";
  const key = (str === "7d" || str === "30d" || str === "90d" ? str : "30d") as PeriodKey;
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

// GET /api/analytics/trends — metric/period/groupBy
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
      const orgId = (authReq.query.org_id as string) || authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const groupBy = (authReq.query.groupBy as string) === "week" ? "week" : "day";
      const metric = (authReq.query.metric as string) || "jobs_created";
      const { since, until } = dateRangeForDays(days);

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, risk_score, status, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", since)
        .lte("created_at", until)
        .limit(MAX_FETCH_LIMIT);

      if (jobsError) throw jobsError;
      const jobList = (jobs || []) as { id: string; risk_score: number | null; status: string | null; created_at: string }[];

      const buckets: { label: string; value: number }[] = [];
      if (groupBy === "week") {
        const weekStart = (d: Date) => {
          const x = new Date(d);
          const day = x.getDay();
          const diff = x.getDate() - day + (day === 0 ? -6 : 1);
          x.setDate(diff);
          x.setHours(0, 0, 0, 0);
          return x.toISOString().slice(0, 10);
        };
        const weekLabels = new Map<string, number>();
        for (const j of jobList) {
          const key = weekStart(new Date(j.created_at));
          if (metric === "jobs_created") weekLabels.set(key, (weekLabels.get(key) ?? 0) + 1);
        }
        if (metric === "completion_rate") {
          const weeks = new Set(jobList.map((j) => weekStart(new Date(j.created_at))));
          for (const w of [...weeks].sort()) {
            const weekTotal = jobList.filter((j) => weekStart(new Date(j.created_at)) === w).length;
            const weekCompleted = jobList.filter((j) => weekStart(new Date(j.created_at)) === w && (j.status?.toLowerCase() === "completed")).length;
            weekLabels.set(w, weekTotal === 0 ? 0 : Math.round((weekCompleted / weekTotal) * 1000) / 1000);
          }
        }
        if (metric === "avg_risk") {
          const byWeek = new Map<string, number[]>();
          for (const j of jobList) {
            if (j.risk_score != null) {
              const key = weekStart(new Date(j.created_at));
              if (!byWeek.has(key)) byWeek.set(key, []);
              byWeek.get(key)!.push(j.risk_score);
            }
          }
          for (const [label] of [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const arr = byWeek.get(label)!;
            buckets.push({ label, value: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 });
          }
          return res.json({ period: `${days}d`, groupBy, metric, data: buckets });
        }
        for (const [label] of [...weekLabels.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          buckets.push({ label, value: weekLabels.get(label) ?? 0 });
        }
      } else {
        const dayLabels = new Map<string, number>();
        for (const j of jobList) {
          const key = toDateKey(j.created_at);
          if (metric === "jobs_created") dayLabels.set(key, (dayLabels.get(key) ?? 0) + 1);
        }
        if (metric === "completion_rate") {
          const days = new Set(jobList.map((j) => toDateKey(j.created_at)));
          for (const d of [...days].sort()) {
            const total = jobList.filter((j) => toDateKey(j.created_at) === d).length;
            const completed = jobList.filter((j) => toDateKey(j.created_at) === d && (j.status?.toLowerCase() === "completed")).length;
            dayLabels.set(d, total === 0 ? 0 : Math.round((completed / total) * 1000) / 1000);
          }
        }
        if (metric === "avg_risk") {
          const byDay = new Map<string, number[]>();
          for (const j of jobList) {
            if (j.risk_score != null) {
              const key = toDateKey(j.created_at);
              if (!byDay.has(key)) byDay.set(key, []);
              byDay.get(key)!.push(j.risk_score);
            }
          }
          for (const [d] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const arr = byDay.get(d)!;
            buckets.push({ label: d, value: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 });
          }
          return res.json({ period: `${days}d`, groupBy, metric, data: buckets });
        }
        for (const [label] of [...dayLabels.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
          buckets.push({ label, value: dayLabels.get(label) ?? 0 });
        }
      }
      return res.json({ period: `${days}d`, groupBy, metric, data: buckets });
    } catch (error: any) {
      console.error("Analytics trends error:", error);
      return res.status(500).json({ message: "Failed to fetch analytics trends" });
    }
  }
);

// GET /api/analytics/risk-heatmap
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
      const orgId = (authReq.query.org_id as string) || authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: jobs, error } = await supabase
        .from("jobs")
        .select("risk_score, risk_level")
        .eq("organization_id", orgId)
        .gte("created_at", since)
        .lte("created_at", until)
        .limit(MAX_FETCH_LIMIT);

      if (error) throw error;
      const list = jobs || [];
      const buckets = [
        { range: "0-25", count: list.filter((j: any) => (j.risk_score ?? 0) >= 0 && (j.risk_score ?? 0) <= 25).length },
        { range: "26-50", count: list.filter((j: any) => (j.risk_score ?? 0) >= 26 && (j.risk_score ?? 0) <= 50).length },
        { range: "51-75", count: list.filter((j: any) => (j.risk_score ?? 0) >= 51 && (j.risk_score ?? 0) <= 75).length },
        { range: "76-100", count: list.filter((j: any) => (j.risk_score ?? 0) >= 76 && (j.risk_score ?? 0) <= 100).length },
      ];
      return res.json({ period: `${days}d`, buckets });
    } catch (error: any) {
      console.error("Analytics risk-heatmap error:", error);
      return res.status(500).json({ message: "Failed to fetch risk heatmap" });
    }
  }
);

// GET /api/analytics/team-performance
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
      const orgId = (authReq.query.org_id as string) || authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: mitigations, error: miError } = await supabase
        .from("mitigation_items")
        .select("completed_by, completed_at")
        .eq("organization_id", orgId)
        .not("completed_at", "is", null)
        .gte("completed_at", since)
        .lte("completed_at", until)
        .limit(MAX_FETCH_LIMIT);

      if (miError) throw miError;
      const byUser: Record<string, number> = {};
      (mitigations || []).forEach((m: any) => {
        const uid = m.completed_by ?? "unknown";
        byUser[uid] = (byUser[uid] ?? 0) + 1;
      });
      const members = Object.entries(byUser)
        .filter(([id]) => id !== "unknown")
        .map(([user_id, completions]) => ({ user_id, completions }))
        .sort((a, b) => b.completions - a.completions)
        .slice(0, 50);
      return res.json({ period: `${days}d`, members });
    } catch (error: any) {
      console.error("Analytics team-performance error:", error);
      return res.status(500).json({ message: "Failed to fetch team performance" });
    }
  }
);

// GET /api/analytics/hazard-frequency
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
      const orgId = (authReq.query.org_id as string) || authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: items, error } = await supabase
        .from("mitigation_items")
        .select("code, title, factor_id")
        .eq("organization_id", orgId)
        .gte("created_at", since)
        .lte("created_at", until)
        .limit(MAX_FETCH_LIMIT);

      if (error) throw error;
      const counts: Record<string, number> = {};
      (items || []).forEach((m: any) => {
        const key = m.code || m.factor_id || m.title || "unknown";
        counts[key] = (counts[key] ?? 0) + 1;
      });
      const list = Object.entries(counts)
        .map(([hazard_id, count]) => ({ hazard_id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 100);
      return res.json({ period: `${days}d`, items: list });
    } catch (error: any) {
      console.error("Analytics hazard-frequency error:", error);
      return res.status(500).json({ message: "Failed to fetch hazard frequency" });
    }
  }
);

// GET /api/analytics/compliance-rate
analyticsRouter.get(
  "/compliance-rate",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({ rate: 0, total: 0, compliant: 0, period: "30d", locked: true });
    }
    try {
      const orgId = (authReq.query.org_id as string) || authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: jobs, error } = await supabase
        .from("jobs")
        .select("id, status")
        .eq("organization_id", orgId)
        .gte("created_at", since)
        .lte("created_at", until)
        .limit(MAX_FETCH_LIMIT);

      if (error) throw error;
      const list = jobs || [];
      const total = list.length;
      const compliant = list.filter((j: any) => (j.status?.toLowerCase() === "completed")).length;
      const rate = total === 0 ? 0 : Math.round((compliant / total) * 10000) / 10000;
      return res.json({ period: `${days}d`, total, compliant, rate });
    } catch (error: any) {
      console.error("Analytics compliance-rate error:", error);
      return res.status(500).json({ message: "Failed to fetch compliance rate" });
    }
  }
);

// GET /api/analytics/job-completion
analyticsRouter.get(
  "/job-completion",
  authenticate as unknown as express.RequestHandler,
  async (req: express.Request, res: express.Response) => {
    const authReq = req as AuthenticatedRequest;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
      return res.json({ total: 0, completed: 0, completion_rate: 0, period: "30d", locked: true });
    }
    try {
      const orgId = (authReq.query.org_id as string) || authReq.user.organization_id;
      if (!orgId) return res.status(400).json({ message: "Missing organization id" });
      const { days } = parsePeriod(authReq.query.period as string);
      const { since, until } = dateRangeForDays(days);

      const { data: jobs, error } = await supabase
        .from("jobs")
        .select("id, status")
        .eq("organization_id", orgId)
        .gte("created_at", since)
        .lte("created_at", until)
        .limit(MAX_FETCH_LIMIT);

      if (error) throw error;
      const list = jobs || [];
      const total = list.length;
      const completed = list.filter((j: any) => (j.status?.toLowerCase() === "completed")).length;
      const completion_rate = total === 0 ? 0 : Math.round((completed / total) * 10000) / 10000;
      return res.json({ period: `${days}d`, total, completed, completion_rate });
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
      const orgId = (authReq.query.org_id as string) || authReq.user.organization_id;
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
      const orgId =
        (authReq.query.org_id as string | undefined) || authReq.user.organization_id;
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

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, risk_score, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", sinceIso)
        .limit(MAX_FETCH_LIMIT);

      if (jobsError) {
        throw jobsError;
      }

      const jobIds = (jobs || []).map((job) => job.id);

      const [mitigationsResponse, documentsResponse] = await Promise.all([
        jobIds.length
          ? supabase
              .from("mitigation_items")
              .select("id, job_id, created_at, completed_at, completed_by")
              .in("job_id", jobIds)
              .order("created_at", { ascending: true })
              .limit(MAX_FETCH_LIMIT)
          : Promise.resolve({ data: [] as MitigationItem[], error: null }),
        jobIds.length
          ? supabase
              .from("documents")
              .select("id, job_id, created_at")
              .in("job_id", jobIds)
              .order("created_at", { ascending: true })
              .limit(MAX_FETCH_LIMIT)
          : Promise.resolve({ data: [] as DocumentRecord[], error: null }),
      ]);

      if (mitigationsResponse.error) {
        throw mitigationsResponse.error;
      }

      if (documentsResponse.error) {
        throw documentsResponse.error;
      }

      const mitigations = (mitigationsResponse.data || []).filter((item) => {
        if (!crewId) return true;
        return item.completed_by === crewId;
      });

      const documents = documentsResponse.data || [];

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
        return job.risk_score > 75;
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

      // Calculate explicit evidence metrics
      const jobsTotal = jobIds.length;
      
      // Jobs with photo evidence (assuming documents with type='photo' or checking file extensions)
      // For now, count all documents as photo evidence (can be refined later)
      const jobsWithPhotoEvidence = jobsWithEvidence;
      
      // Jobs missing required evidence - use readiness rules or default: high-risk jobs without evidence
      const highRiskJobIds = (jobs || [])
        .filter((job) => job.risk_score !== null && job.risk_score > 75)
        .map((job) => job.id);
      const highRiskJobsWithoutEvidence = highRiskJobIds.filter(
        (jobId) => !jobEvidenceMap[jobId]
      ).length;
      const jobsMissingRequiredEvidence = highRiskJobsWithoutEvidence;

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
      
      const avgTimeToFirstPhotoMinutes = avgTimeToFirstEvidenceHours * 60;

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
        avg_time_to_first_photo_minutes: avgTimeToFirstPhotoMinutes ? Number(avgTimeToFirstPhotoMinutes.toFixed(0)) : null,
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
      const orgId =
        (authReq.query.org_id as string | undefined) || authReq.user.organization_id;
      if (!orgId) {
        return res.status(400).json({ message: "Missing organization id" });
      }

      const rangeDays = parseRangeDays(authReq.query.range as string | undefined);
      const sinceDate = new Date();
      sinceDate.setHours(0, 0, 0, 0);
      sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1));
      const sinceIso = sinceDate.toISOString();

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, status, risk_level, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", sinceIso)
        .limit(MAX_FETCH_LIMIT);

      if (jobsError) throw jobsError;

      const jobList = (jobs || []) as JobSummaryRecord[];
      const jobIds = jobList.map((j) => j.id);

      const [documentsResponse, mitigationsResponse] = await Promise.all([
        jobIds.length
          ? supabase
              .from("documents")
              .select("id, job_id")
              .in("job_id", jobIds)
              .limit(MAX_FETCH_LIMIT)
          : Promise.resolve({ data: [] as { job_id: string }[], error: null }),
        jobIds.length
          ? supabase
              .from("mitigation_items")
              .select("id, job_id, completed_at, completed_by")
              .in("job_id", jobIds)
              .not("completed_at", "is", null)
              .gte("completed_at", sinceIso)
              .limit(MAX_FETCH_LIMIT)
          : Promise.resolve({
              data: [] as { job_id: string; completed_by: string | null }[],
              error: null,
            }),
      ]);

      if (documentsResponse.error) throw documentsResponse.error;
      if (mitigationsResponse.error) throw mitigationsResponse.error;

      const documents = documentsResponse.data || [];
      const completions = mitigationsResponse.data || [];

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

