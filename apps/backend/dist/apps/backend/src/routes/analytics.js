"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
exports.getAnalyticsObservability = getAnalyticsObservability;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const insights_1 = require("../services/insights");
exports.analyticsRouter = express_1.default.Router();
// In-memory cache for insights: 1h TTL per org
const INSIGHTS_CACHE_TTL_MS = 60 * 60 * 1000;
const insightsCache = new Map();
let insightsCacheHits = 0;
let insightsCacheMisses = 0;
async function getCachedInsights(orgId) {
    const entry = insightsCache.get(orgId);
    if (entry && Date.now() < entry.expires) {
        insightsCacheHits += 1;
        return entry.data;
    }
    insightsCacheMisses += 1;
    const data = await (0, insights_1.generateInsights)(orgId);
    insightsCache.set(orgId, { data, expires: Date.now() + INSIGHTS_CACHE_TTL_MS });
    return data;
}
/** Analytics observability: cache hit rates and entry count for metrics endpoint. */
function getAnalyticsObservability() {
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
const PAGE_SIZE = 2000;
/** Fetch all rows by paginating; no cap. */
async function fetchAllPages(fetchPage) {
    const out = [];
    let offset = 0;
    let hasMore = true;
    let lastError = null;
    while (hasMore) {
        const { data, error } = await fetchPage(offset, PAGE_SIZE);
        if (error)
            return { data: out, error };
        lastError = error;
        const chunkData = data ?? [];
        out.push(...chunkData);
        hasMore = chunkData.length === PAGE_SIZE;
        offset += chunkData.length;
    }
    return { data: out, error: lastError };
}
/** Chunk array into batches of at most size. */
function chunkArray(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size)
        result.push(arr.slice(i, i + size));
    return result;
}
const parseRangeDays = (value) => {
    if (!value)
        return 30;
    const str = Array.isArray(value) ? value[0] : value;
    const match = str.match(/(\d+)/);
    if (!match)
        return 30;
    const days = parseInt(match[1], 10);
    if (Number.isNaN(days) || days <= 0)
        return 30;
    return Math.min(days, 180);
};
const toDateKey = (value) => value.slice(0, 10);
// --- Period parsing for analytics (7d, 30d, 90d, 1y) ---
const PERIOD_DAYS = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
const parsePeriod = (value) => {
    const str = value ? (Array.isArray(value) ? value[0] : value) : "30d";
    const key = (str === "7d" || str === "30d" || str === "90d" || str === "1y" ? str : "30d");
    return { days: PERIOD_DAYS[key], key };
};
const dateRangeForDays = (days) => {
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
const weekStart = (d) => {
    const x = new Date(d);
    const day = x.getDay();
    const diff = x.getDate() - day + (day === 0 ? -6 : 1);
    x.setDate(diff);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
};
const monthStart = (d) => {
    const x = new Date(d);
    x.setDate(1);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
};
// GET /api/analytics/trends — metric (jobs|risk|compliance), period (7d|30d|90d|1y), groupBy (day|week|month)
// Response: { period, groupBy, metric, data: Array<{ period, value, label }> }
exports.analyticsRouter.get("/trends", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({ period: "30d", groupBy: "day", data: [], locked: true });
    }
    try {
        const orgId = authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days, key: periodKey } = parsePeriod(authReq.query.period);
        const groupByRaw = authReq.query.groupBy || "day";
        const groupBy = groupByRaw === "month" ? "month" : groupByRaw === "week" ? "week" : "day";
        const metricRaw = authReq.query.metric || "jobs";
        const metric = metricRaw === "risk"
            ? "risk"
            : metricRaw === "compliance"
                ? "compliance"
                : metricRaw === "completion" || metricRaw === "completion_rate"
                    ? "completion"
                    : "jobs";
        const { since, until } = dateRangeForDays(days);
        const points = [];
        const periodLabel = periodKey === "1y" ? "1y" : `${days}d`;
        // Compliance trend: SQL-side aggregation only (no full row fetch)
        if (metric === "compliance") {
            const { data: complianceRows, error: complianceError } = await supabaseClient_1.supabase.rpc("get_trends_compliance_buckets", {
                p_org_id: orgId,
                p_since: since,
                p_until: until,
                p_group_by: groupBy,
            });
            if (!complianceError && complianceRows && Array.isArray(complianceRows)) {
                const compPoints = complianceRows.map((r) => {
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
            if (complianceError)
                throw complianceError;
        }
        const useMv = (groupBy === "week" || groupBy === "month") && days <= MV_COVERAGE_DAYS && metric !== "compliance";
        if (useMv) {
            const sinceWeek = weekStart(new Date(since));
            const untilWeek = weekStart(new Date(until));
            const { data: mvRows, error: mvError } = await fetchAllPages(async (offset, limit) => {
                const { data, error } = await supabaseClient_1.supabase
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
                const rows = mvRows;
                if (groupBy === "week") {
                    for (const r of rows) {
                        const period = typeof r.week_start === "string" ? r.week_start.slice(0, 10) : String(r.week_start).slice(0, 10);
                        let value = 0;
                        if (metric === "jobs")
                            value = r.jobs_created ?? 0;
                        else if (metric === "risk")
                            value = r.avg_risk != null ? Math.round(r.avg_risk * 100) / 100 : 0;
                        else if (metric === "completion")
                            value = (r.jobs_created ?? 0) === 0 ? 0 : Math.round(((r.jobs_completed ?? 0) / (r.jobs_created ?? 1)) * 10000) / 100;
                        points.push({ period, value, label: period });
                    }
                }
                else {
                    const byMonth = new Map();
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
                        const cur = byMonth.get(period);
                        let value = 0;
                        if (metric === "jobs")
                            value = cur.jobs_created;
                        else if (metric === "risk")
                            value = cur.riskWeight === 0 ? 0 : Math.round((cur.riskSum / cur.riskWeight) * 100) / 100;
                        else if (metric === "completion")
                            value = cur.jobs_created === 0 ? 0 : Math.round((cur.jobs_completed / cur.jobs_created) * 10000) / 100;
                        points.push({ period, value, label: period });
                    }
                }
                const periodLabel = periodKey === "1y" ? "1y" : `${days}d`;
                return res.json({ period: periodLabel, groupBy, metric, data: points });
            }
        }
        const { data: jobs, error: jobsError } = await fetchAllPages(async (offset, limit) => {
            const { data, error } = await supabaseClient_1.supabase
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
        if (jobsError)
            throw jobsError;
        const jobList = (jobs || []);
        const getBucketKey = (date) => groupBy === "month" ? monthStart(date) : groupBy === "week" ? weekStart(date) : toDateKey(date.toISOString());
        const bucketValues = new Map();
        const bucketRiskSums = new Map();
        const bucketCompletion = new Map();
        for (const j of jobList) {
            const key = getBucketKey(new Date(j.created_at));
            const completed = j.status?.toLowerCase() === "completed";
            if (metric === "completion") {
                const cur = bucketCompletion.get(key) ?? { total: 0, completed: 0 };
                cur.total += 1;
                if (completed)
                    cur.completed += 1;
                bucketCompletion.set(key, cur);
            }
            else if (metric === "jobs") {
                bucketValues.set(key, (bucketValues.get(key) ?? 0) + 1);
            }
            else if (metric === "risk" && j.risk_score != null) {
                const cur = bucketRiskSums.get(key) ?? { sum: 0, count: 0 };
                cur.sum += j.risk_score;
                cur.count += 1;
                bucketRiskSums.set(key, cur);
            }
        }
        if (metric === "completion") {
            for (const [period] of [...bucketCompletion.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
                const { total, completed } = bucketCompletion.get(period);
                const value = total === 0 ? 0 : Math.round((completed / total) * 10000) / 100;
                points.push({ period, value, label: period });
            }
        }
        else if (metric === "jobs") {
            for (const [period] of [...bucketValues.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
                points.push({ period, value: bucketValues.get(period) ?? 0, label: period });
            }
        }
        else if (metric === "risk") {
            for (const [period] of [...bucketRiskSums.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
                const { sum, count } = bucketRiskSums.get(period);
                const value = count === 0 ? 0 : Math.round((sum / count) * 100) / 100;
                points.push({ period, value, label: period });
            }
        }
        return res.json({ period: periodLabel, groupBy, metric, data: points });
    }
    catch (error) {
        console.error("Analytics trends error:", error);
        return res.status(500).json({ message: "Failed to fetch analytics trends" });
    }
});
// GET /api/analytics/risk-heatmap — SQL-side aggregation by job_type and day_of_week
exports.analyticsRouter.get("/risk-heatmap", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({ buckets: [], locked: true });
    }
    try {
        const orgId = authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const { data: rows, error } = await supabaseClient_1.supabase.rpc("get_risk_heatmap_buckets", {
            p_org_id: orgId,
            p_since: since,
            p_until: until,
        });
        if (error)
            throw error;
        const list = (Array.isArray(rows) ? rows : []);
        const buckets = list.map((r) => ({
            job_type: r.job_type ?? "other",
            day_of_week: Number(r.day_of_week ?? 0),
            avg_risk: Number(r.avg_risk ?? 0),
            count: Number(r.count ?? 0),
        }));
        return res.json({ period: `${days}d`, buckets });
    }
    catch (error) {
        console.error("Analytics risk-heatmap error:", error);
        return res.status(500).json({ message: "Failed to fetch risk heatmap" });
    }
});
// GET /api/analytics/team-performance — jobs_assigned, jobs_completed, completion_rate, avg_days, overdue_count per user
// Server-side aggregate via get_team_performance_kpis RPC; jobs_assigned includes all open assigned (including pre-period).
exports.analyticsRouter.get("/team-performance", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({ members: [], locked: true });
    }
    try {
        const orgId = authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const { data: kpiRows, error: rpcError } = await supabaseClient_1.supabase.rpc("get_team_performance_kpis", {
            p_org_id: orgId,
            p_since: since,
            p_until: until,
        });
        if (rpcError)
            throw rpcError;
        const rows = (Array.isArray(kpiRows) ? kpiRows : []);
        const members = rows.map((r) => {
            const jobs_assigned = Number(r.jobs_assigned ?? 0);
            const jobs_completed = Number(r.jobs_completed ?? 0);
            const completion_rate = jobs_assigned === 0 ? 0 : Math.round((jobs_completed / jobs_assigned) * 10000) / 100;
            const count_completed = Number(r.count_completed ?? 0);
            const sum_days = Number(r.sum_days ?? 0);
            const avg_days = count_completed === 0 ? 0 : Math.round((sum_days / count_completed) * 100) / 100;
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
        const userMap = new Map();
        if (userIds.length > 0) {
            const { data: userRows } = await supabaseClient_1.supabase
                .from("users")
                .select("id, full_name")
                .in("id", userIds);
            for (const u of userRows || []) {
                const name = u.full_name ?? "";
                userMap.set(u.id, name.trim() || "Unknown");
            }
        }
        const membersWithNames = topMembers.map((m) => ({
            ...m,
            name: userMap.get(m.user_id) ?? "Unknown",
        }));
        return res.json({ period: `${days}d`, members: membersWithNames });
    }
    catch (error) {
        console.error("Analytics team-performance error:", error);
        return res.status(500).json({ message: "Failed to fetch team performance" });
    }
});
// GET /api/analytics/hazard-frequency — SQL-side aggregation by type|location, trend vs previous window
exports.analyticsRouter.get("/hazard-frequency", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({ items: [], locked: true });
    }
    try {
        const orgId = authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const groupBy = authReq.query.groupBy === "location" ? "location" : "type";
        const prevUntil = since;
        const prevSince = new Date(new Date(since).getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        const { data: rows, error } = await supabaseClient_1.supabase.rpc("get_hazard_frequency_buckets", {
            p_org_id: orgId,
            p_since: since,
            p_until: until,
            p_prev_since: prevSince,
            p_prev_until: prevUntil,
            p_group_by: groupBy,
        });
        if (error)
            throw error;
        const list = (Array.isArray(rows) ? rows : []);
        const itemsOut = list.map((r) => {
            const count = Number(r.count ?? 0);
            const prevCount = Number(r.prev_count ?? 0);
            const trend = prevCount === 0 ? (count > 0 ? "up" : "neutral") : count > prevCount ? "up" : count < prevCount ? "down" : "neutral";
            return {
                category: r.category ?? "unknown",
                count,
                avg_risk: Number(r.avg_risk ?? 0),
                trend,
            };
        });
        return res.json({ period: `${days}d`, groupBy, items: itemsOut.slice(0, 100) });
    }
    catch (error) {
        console.error("Analytics hazard-frequency error:", error);
        return res.status(500).json({ message: "Failed to fetch hazard frequency" });
    }
});
// GET /api/analytics/compliance-rate — SQL-side aggregation: signature, photo, checklist, overall (0–100)
exports.analyticsRouter.get("/compliance-rate", auth_1.authenticate, async (req, res) => {
    const authReq = req;
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
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const { data: kpiRows, error: rpcError } = await supabaseClient_1.supabase.rpc("get_compliance_rate_kpis", {
            p_org_id: orgId,
            p_since: since,
            p_until: until,
        });
        if (rpcError)
            throw rpcError;
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
    }
    catch (error) {
        console.error("Analytics compliance-rate error:", error);
        return res.status(500).json({ message: "Failed to fetch compliance rate" });
    }
});
// GET /api/analytics/job-completion — contract: completion_rate, avg_days, on_time_rate, overdue_count; optional: total, completed, period, avg_days_to_complete
// Server-side aggregate via get_job_completion_kpis RPC; period-scoped overdue_count + overdue_count_all_time.
exports.analyticsRouter.get("/job-completion", auth_1.authenticate, async (req, res) => {
    const authReq = req;
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
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const { data: kpiRows, error: rpcError } = await supabaseClient_1.supabase.rpc("get_job_completion_kpis", {
            p_org_id: orgId,
            p_since: since,
            p_until: until,
        });
        if (rpcError)
            throw rpcError;
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
    }
    catch (error) {
        console.error("Analytics job-completion error:", error);
        return res.status(500).json({ message: "Failed to fetch job completion" });
    }
});
// GET /api/analytics/insights — top 5 predictive insights (cached 1h)
exports.analyticsRouter.get("/insights", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({ insights: [], locked: true });
    }
    try {
        const orgId = authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const all = await getCachedInsights(orgId);
        const insights = all.slice(0, 5);
        return res.json({ insights });
    }
    catch (error) {
        console.error("Analytics insights error:", error);
        return res.status(500).json({ message: "Failed to fetch insights" });
    }
});
exports.analyticsRouter.get("/mitigations", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    // Soft check: return empty analytics data if plan is inactive (better UX than 402)
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        // Return empty analytics data instead of 402 (better UX)
        return res.json({
            org_id: authReq.user.organization_id,
            range_days: parseRangeDays(authReq.query.range),
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
        const rangeDays = parseRangeDays(authReq.query.range);
        const crewId = authReq.query.crew_id
            ? String(authReq.query.crew_id)
            : undefined;
        const sinceDate = new Date();
        sinceDate.setHours(0, 0, 0, 0);
        sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1));
        const sinceIso = sinceDate.toISOString();
        // When crew_id is supplied, scope jobs to those that have mitigation activity by this crew (denominators consistent with crew filter).
        let jobIdsFilter = null;
        if (crewId) {
            const { data: crewMitigationRows } = await fetchAllPages(async (offset, limit) => {
                const { data, error } = await supabaseClient_1.supabase
                    .from("mitigation_items")
                    .select("job_id")
                    .eq("organization_id", orgId)
                    .eq("completed_by", crewId)
                    .or(`created_at.gte.${sinceIso},completed_at.gte.${sinceIso}`)
                    .range(offset, offset + limit - 1);
                return { data, error };
            });
            const crewJobIdsSet = new Set((crewMitigationRows ?? []).map((r) => r.job_id));
            jobIdsFilter = crewJobIdsSet.size > 0 ? [...crewJobIdsSet] : [];
        }
        let jobs;
        if (jobIdsFilter !== null) {
            if (jobIdsFilter.length === 0) {
                jobs = [];
            }
            else {
                const jobsList = [];
                for (const idChunk of chunkArray(jobIdsFilter, 500)) {
                    const { data, error } = await supabaseClient_1.supabase
                        .from("jobs")
                        .select("id, risk_score, created_at")
                        .eq("organization_id", orgId)
                        .is("deleted_at", null)
                        .in("id", idChunk);
                    if (error)
                        throw error;
                    jobsList.push(...(data ?? []));
                }
                jobs = jobsList;
            }
        }
        else {
            const { data: jobsData, error: jobsError } = await fetchAllPages(async (offset, limit) => {
                const { data, error } = await supabaseClient_1.supabase
                    .from("jobs")
                    .select("id, risk_score, created_at")
                    .eq("organization_id", orgId)
                    .is("deleted_at", null)
                    .gte("created_at", sinceIso)
                    .order("created_at", { ascending: true })
                    .range(offset, offset + limit - 1);
                return { data, error };
            });
            if (jobsError)
                throw jobsError;
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
        const mitigationsRaw = [];
        for (const ids of mitigationsByChunk) {
            const { data, error } = await fetchAllPages(async (offset, limit) => {
                let query = supabaseClient_1.supabase
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
            if (error)
                throw error;
            mitigationsRaw.push(...(data ?? []));
        }
        const documentsByChunk = chunkArray(jobIds, 500);
        const documentsRaw = [];
        for (const ids of documentsByChunk) {
            const { data, error } = await fetchAllPages(async (offset, limit) => {
                let query = supabaseClient_1.supabase
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
            if (error)
                throw error;
            documentsRaw.push(...(data ?? []));
        }
        const mitigations = mitigationsRaw.filter((item) => {
            if (!crewId)
                return true;
            return item.completed_by === crewId;
        });
        const documents = documentsRaw;
        const totalMitigations = mitigations.length;
        const completedMitigations = mitigations.filter((item) => item.completed_at);
        const completionRate = totalMitigations === 0
            ? 0
            : completedMitigations.length / totalMitigations;
        const avgTimeToCloseHours = completedMitigations.length === 0
            ? 0
            : completedMitigations.reduce((acc, item) => {
                const createdAt = new Date(item.created_at).getTime();
                const completedAt = new Date(item.completed_at).getTime();
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
        const jobEvidenceMap = documents.reduce((acc, doc) => {
            if (!acc[doc.job_id] || new Date(doc.created_at) < new Date(acc[doc.job_id])) {
                acc[doc.job_id] = doc.created_at;
            }
            return acc;
        }, {});
        const jobsWithEvidence = Object.keys(jobEvidenceMap).length;
        const jobsWithoutEvidence = Math.max(jobIds.length - jobsWithEvidence, 0);
        // Photo evidence: only documents with type === "photo"
        const photoDocuments = documents.filter((d) => d.type === "photo");
        const jobPhotoMap = photoDocuments.reduce((acc, doc) => {
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
        const highRiskJobsWithoutPhotoEvidence = highRiskJobIds.filter((jobId) => !jobPhotoMap[jobId]).length;
        const jobsMissingRequiredEvidence = highRiskJobsWithoutPhotoEvidence;
        const avgTimeToFirstEvidenceHours = jobsWithEvidence === 0
            ? 0
            : Object.entries(jobEvidenceMap).reduce((acc, [jobId, firstEvidence]) => {
                const job = jobs?.find((item) => item.id === jobId);
                if (!job)
                    return acc;
                const jobCreated = new Date(job.created_at).getTime();
                const evidenceCreated = new Date(firstEvidence).getTime();
                const diffHours = (evidenceCreated - jobCreated) / (1000 * 60 * 60);
                return acc + Math.max(diffHours, 0);
            }, 0) / jobsWithEvidence;
        const avgTimeToFirstPhotoMinutes = jobsWithPhotoEvidence === 0
            ? 0
            : Object.entries(jobPhotoMap).reduce((acc, [jobId, firstPhotoAt]) => {
                const job = jobs?.find((item) => item.id === jobId);
                if (!job)
                    return acc;
                const jobCreated = new Date(job.created_at).getTime();
                const photoCreated = new Date(firstPhotoAt).getTime();
                const diffMinutes = (photoCreated - jobCreated) / (1000 * 60);
                return acc + Math.max(diffMinutes, 0);
            }, 0) / jobsWithPhotoEvidence;
        // Trend (daily)
        const trend = [];
        const dateCursor = new Date(sinceDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        while (dateCursor <= today) {
            const dateKey = dateCursor.toISOString().slice(0, 10);
            const itemsForDay = mitigations.filter((item) => toDateKey(item.created_at) === dateKey);
            const dayCompleted = itemsForDay.filter((item) => {
                if (!item.completed_at)
                    return false;
                return toDateKey(item.completed_at) === dateKey;
            });
            const dayRate = itemsForDay.length === 0
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
    }
    catch (error) {
        console.error("Analytics metrics error:", error);
        res.status(500).json({ message: "Failed to fetch analytics metrics" });
    }
});
exports.analyticsRouter.get("/summary", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({
            org_id: authReq.user.organization_id ?? "",
            range_days: parseRangeDays(authReq.query.range),
            job_counts_by_status: {},
            risk_level_distribution: {},
            evidence_statistics: {
                total_items: 0,
                jobs_with_evidence: 0,
                jobs_without_evidence: 0,
            },
            team_activity: [],
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
        const rangeDays = parseRangeDays(authReq.query.range);
        const sinceDate = new Date();
        sinceDate.setHours(0, 0, 0, 0);
        sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1));
        const sinceIso = sinceDate.toISOString();
        const { data: jobs, error: jobsError } = await fetchAllPages(async (offset, limit) => {
            const { data, error } = await supabaseClient_1.supabase
                .from("jobs")
                .select("id, status, risk_level, created_at")
                .eq("organization_id", orgId)
                .is("deleted_at", null)
                .gte("created_at", sinceIso)
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1);
            return { data, error };
        });
        if (jobsError)
            throw jobsError;
        const jobList = (jobs ?? []);
        const jobIds = jobList.map((j) => j.id);
        const documents = [];
        const completions = [];
        for (const idChunk of chunkArray(jobIds, 500)) {
            const [docRes, mitRes] = await Promise.all([
                fetchAllPages(async (o, l) => {
                    const { data, error } = await supabaseClient_1.supabase
                        .from("documents")
                        .select("id, job_id")
                        .eq("organization_id", orgId)
                        .in("job_id", idChunk)
                        .order("created_at", { ascending: false })
                        .range(o, o + l - 1);
                    return { data, error };
                }),
                fetchAllPages(async (o, l) => {
                    const { data, error } = await supabaseClient_1.supabase
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
            if (docRes.error)
                throw docRes.error;
            if (mitRes.error)
                throw mitRes.error;
            documents.push(...(docRes.data ?? []));
            completions.push(...(mitRes.data ?? []));
        }
        const jobCountsByStatus = {};
        for (const job of jobList) {
            const s = job.status ?? "unknown";
            jobCountsByStatus[s] = (jobCountsByStatus[s] ?? 0) + 1;
        }
        const riskLevelDistribution = {};
        for (const job of jobList) {
            const level = (job.risk_level ?? "unscored").toLowerCase();
            riskLevelDistribution[level] = (riskLevelDistribution[level] ?? 0) + 1;
        }
        const jobsWithEvidenceSet = new Set(documents.map((d) => d.job_id).filter(Boolean));
        const jobsWithEvidence = jobsWithEvidenceSet.size;
        const jobsWithoutEvidence = Math.max(jobIds.length - jobsWithEvidence, 0);
        const evidenceStatistics = {
            total_items: documents.length,
            jobs_with_evidence: jobsWithEvidence,
            jobs_without_evidence: jobsWithoutEvidence,
        };
        const completionsByUser = {};
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
    }
    catch (error) {
        console.error("Analytics summary error:", error);
        res.status(500).json({ message: "Failed to fetch analytics summary" });
    }
});
//# sourceMappingURL=analytics.js.map