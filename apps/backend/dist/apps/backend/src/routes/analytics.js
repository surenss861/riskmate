"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
const insights_1 = require("../services/insights");
exports.analyticsRouter = express_1.default.Router();
// In-memory cache for insights: 1h TTL per org
const INSIGHTS_CACHE_TTL_MS = 60 * 60 * 1000;
const insightsCache = new Map();
async function getCachedInsights(orgId) {
    const entry = insightsCache.get(orgId);
    if (entry && Date.now() < entry.expires)
        return entry.data;
    const data = await (0, insights_1.generateInsights)(orgId);
    insightsCache.set(orgId, { data, expires: Date.now() + INSIGHTS_CACHE_TTL_MS });
    return data;
}
const MAX_FETCH_LIMIT = 10000;
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
        const orgId = authReq.query.org_id || authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days, key: periodKey } = parsePeriod(authReq.query.period);
        const groupByRaw = authReq.query.groupBy || "day";
        const groupBy = groupByRaw === "month" ? "month" : groupByRaw === "week" ? "week" : "day";
        const metricRaw = authReq.query.metric || "jobs";
        const metric = metricRaw === "risk" ? "risk" : metricRaw === "compliance" ? "compliance" : "jobs";
        const { since, until } = dateRangeForDays(days);
        const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, risk_score, status, created_at")
            .eq("organization_id", orgId)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_FETCH_LIMIT);
        if (jobsError)
            throw jobsError;
        const jobList = (jobs || []);
        const getBucketKey = (date) => groupBy === "month" ? monthStart(date) : groupBy === "week" ? weekStart(date) : toDateKey(date.toISOString());
        const points = [];
        const bucketValues = new Map();
        const bucketRiskSums = new Map();
        const bucketCompletion = new Map();
        for (const j of jobList) {
            const key = getBucketKey(new Date(j.created_at));
            if (metric === "jobs") {
                bucketValues.set(key, (bucketValues.get(key) ?? 0) + 1);
            }
            else if (metric === "risk" && j.risk_score != null) {
                const cur = bucketRiskSums.get(key) ?? { sum: 0, count: 0 };
                cur.sum += j.risk_score;
                cur.count += 1;
                bucketRiskSums.set(key, cur);
            }
            else if (metric === "compliance") {
                const cur = bucketCompletion.get(key) ?? { total: 0, completed: 0 };
                cur.total += 1;
                if (j.status?.toLowerCase() === "completed")
                    cur.completed += 1;
                bucketCompletion.set(key, cur);
            }
        }
        if (metric === "jobs") {
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
        else {
            for (const [period] of [...bucketCompletion.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
                const { total, completed } = bucketCompletion.get(period);
                const value = total === 0 ? 0 : Math.round((completed / total) * 10000) / 10000;
                points.push({ period, value, label: period });
            }
        }
        const periodLabel = periodKey === "1y" ? "1y" : `${days}d`;
        return res.json({ period: periodLabel, groupBy, metric, data: points });
    }
    catch (error) {
        console.error("Analytics trends error:", error);
        return res.status(500).json({ message: "Failed to fetch analytics trends" });
    }
});
// GET /api/analytics/risk-heatmap — aggregate by job_type and day_of_week (30d/90d), avg_risk and count per bucket
exports.analyticsRouter.get("/risk-heatmap", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({ buckets: [], locked: true });
    }
    try {
        const orgId = authReq.query.org_id || authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const { data: jobs, error } = await supabaseClient_1.supabase
            .from("jobs")
            .select("job_type, risk_score, created_at")
            .eq("organization_id", orgId)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_FETCH_LIMIT);
        if (error)
            throw error;
        const list = (jobs || []);
        const bucketSums = {};
        for (const j of list) {
            const jobType = j.job_type ?? "other";
            const dayOfWeek = new Date(j.created_at).getDay();
            const key = `${jobType}|${dayOfWeek}`;
            if (!bucketSums[key])
                bucketSums[key] = { sum: 0, count: 0 };
            bucketSums[key].count += 1;
            if (j.risk_score != null)
                bucketSums[key].sum += j.risk_score;
        }
        const buckets = Object.entries(bucketSums).map(([key, { sum, count }]) => {
            const [job_type, day_of_week_str] = key.split("|");
            const avg_risk = count === 0 ? 0 : Math.round((sum / count) * 100) / 100;
            return { job_type, day_of_week: parseInt(day_of_week_str, 10), avg_risk, count };
        });
        return res.json({ period: `${days}d`, buckets });
    }
    catch (error) {
        console.error("Analytics risk-heatmap error:", error);
        return res.status(500).json({ message: "Failed to fetch risk heatmap" });
    }
});
// GET /api/analytics/team-performance — jobs_assigned, jobs_completed, completion_rate, avg_days to complete, overdue_count per user
exports.analyticsRouter.get("/team-performance", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({ members: [], locked: true });
    }
    try {
        const orgId = authReq.query.org_id || authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const now = new Date().toISOString();
        const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, assigned_to_id, status, created_at, updated_at, due_date")
            .eq("organization_id", orgId)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_FETCH_LIMIT);
        if (jobsError)
            throw jobsError;
        const jobList = (jobs || []);
        const byUser = {};
        for (const j of jobList) {
            const uid = j.assigned_to_id ?? "unassigned";
            if (uid === "unassigned")
                continue;
            if (!byUser[uid])
                byUser[uid] = {
                    jobs_assigned: 0,
                    jobs_completed: 0,
                    completion_rate: 0,
                    avg_days_to_complete: 0,
                    overdue_count: 0,
                };
            byUser[uid].jobs_assigned += 1;
            const completed = j.status?.toLowerCase() === "completed";
            if (completed)
                byUser[uid].jobs_completed += 1;
            if (j.due_date && j.due_date < now && !completed)
                byUser[uid].overdue_count += 1;
        }
        const completedDurations = {};
        for (const j of jobList) {
            if (j.assigned_to_id == null || j.status?.toLowerCase() !== "completed")
                continue;
            const completedAt = j.updated_at ?? j.created_at;
            const created = new Date(j.created_at).getTime();
            const completed = new Date(completedAt).getTime();
            const daysToComplete = (completed - created) / (1000 * 60 * 60 * 24);
            if (!completedDurations[j.assigned_to_id])
                completedDurations[j.assigned_to_id] = [];
            completedDurations[j.assigned_to_id].push(daysToComplete);
        }
        const members = Object.entries(byUser).map(([user_id, s]) => {
            const completion_rate = s.jobs_assigned === 0 ? 0 : Math.round((s.jobs_completed / s.jobs_assigned) * 10000) / 10000;
            const durations = completedDurations[user_id] ?? [];
            const avg_days_to_complete = durations.length === 0 ? 0 : Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 100) / 100;
            return {
                user_id,
                jobs_assigned: s.jobs_assigned,
                jobs_completed: s.jobs_completed,
                completion_rate,
                avg_days_to_complete,
                overdue_count: s.overdue_count,
            };
        });
        members.sort((a, b) => b.jobs_completed - a.jobs_completed);
        const topMembers = members.slice(0, 50);
        return res.json({ period: `${days}d`, members: topMembers });
    }
    catch (error) {
        console.error("Analytics team-performance error:", error);
        return res.status(500).json({ message: "Failed to fetch team performance" });
    }
});
// GET /api/analytics/hazard-frequency — groupBy type|location, count and avg_risk per category, trend vs previous window
exports.analyticsRouter.get("/hazard-frequency", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({ items: [], locked: true });
    }
    try {
        const orgId = authReq.query.org_id || authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const groupBy = authReq.query.groupBy === "location" ? "location" : "type";
        const { data: items, error } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .select("id, job_id, code, title, factor_id")
            .eq("organization_id", orgId)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_FETCH_LIMIT);
        if (error)
            throw error;
        const itemList = (items || []);
        const jobIds = [...new Set(itemList.map((m) => m.job_id))];
        const { data: jobsData } = jobIds.length > 0
            ? await supabaseClient_1.supabase.from("jobs").select("id, risk_score, location").in("id", jobIds).limit(MAX_FETCH_LIMIT)
            : { data: [] };
        const jobMap = new Map((jobsData || []).map((j) => [j.id, { risk_score: j.risk_score, location: j.location ?? "unknown" }]));
        const current = {};
        for (const m of itemList) {
            const category = groupBy === "location" ? (jobMap.get(m.job_id)?.location ?? "unknown") : (m.code || m.factor_id || m.title || "unknown");
            if (!current[category])
                current[category] = { count: 0, riskSum: 0, riskCount: 0 };
            current[category].count += 1;
            const score = jobMap.get(m.job_id)?.risk_score;
            if (score != null) {
                current[category].riskSum += score;
                current[category].riskCount += 1;
            }
        }
        const prevSince = new Date(new Date(since).getTime() - days * 24 * 60 * 60 * 1000).toISOString();
        const prevUntil = since;
        const { data: prevItems } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .select("id, job_id, code, title, factor_id")
            .eq("organization_id", orgId)
            .gte("created_at", prevSince)
            .lt("created_at", prevUntil)
            .limit(MAX_FETCH_LIMIT);
        const prevList = (prevItems || []);
        const prevJobIds = [...new Set(prevList.map((m) => m.job_id))];
        const { data: prevJobsData } = prevJobIds.length > 0
            ? await supabaseClient_1.supabase.from("jobs").select("id, risk_score, location").in("id", prevJobIds).limit(MAX_FETCH_LIMIT)
            : { data: [] };
        const prevJobMap = new Map((prevJobsData || []).map((j) => [j.id, { risk_score: j.risk_score, location: j.location ?? "unknown" }]));
        const prev = {};
        for (const m of prevList) {
            const category = groupBy === "location" ? (prevJobMap.get(m.job_id)?.location ?? "unknown") : (m.code || m.factor_id || m.title || "unknown");
            if (!prev[category])
                prev[category] = { count: 0, riskSum: 0, riskCount: 0 };
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
    }
    catch (error) {
        console.error("Analytics hazard-frequency error:", error);
        return res.status(500).json({ message: "Failed to fetch hazard frequency" });
    }
});
// GET /api/analytics/compliance-rate — signature completion, photo upload, checklist completion, overall rate
exports.analyticsRouter.get("/compliance-rate", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({
            signature_completion_rate: 0,
            photo_upload_rate: 0,
            checklist_completion_rate: 0,
            overall_rate: 0,
            period: "30d",
            locked: true,
        });
    }
    try {
        const orgId = authReq.query.org_id || authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id")
            .eq("organization_id", orgId)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_FETCH_LIMIT);
        if (jobsError)
            throw jobsError;
        const jobList = jobs || [];
        const jobIds = jobList.map((j) => j.id);
        const totalJobs = jobIds.length;
        if (totalJobs === 0) {
            return res.json({
                period: `${days}d`,
                signature_completion_rate: 0,
                photo_upload_rate: 0,
                checklist_completion_rate: 0,
                overall_rate: 0,
            });
        }
        const [sigRes, photoRes, checklistRes] = await Promise.all([
            supabaseClient_1.supabase.from("signatures").select("job_id").eq("organization_id", orgId).in("job_id", jobIds).limit(MAX_FETCH_LIMIT),
            jobIds.length > 0
                ? supabaseClient_1.supabase.from("documents").select("job_id").eq("organization_id", orgId).eq("type", "photo").in("job_id", jobIds).limit(MAX_FETCH_LIMIT)
                : Promise.resolve({ data: [] }),
            supabaseClient_1.supabase
                .from("mitigation_items")
                .select("job_id, completed_at")
                .eq("organization_id", orgId)
                .in("job_id", jobIds)
                .limit(MAX_FETCH_LIMIT),
        ]);
        const jobsWithSignature = new Set((sigRes.data || []).map((r) => r.job_id)).size;
        const jobsWithPhoto = new Set((photoRes.data || []).map((r) => r.job_id)).size;
        const mitigationList = (checklistRes.data || []);
        let checklistTotal = 0;
        let checklistCompleted = 0;
        for (const m of mitigationList) {
            checklistTotal += 1;
            if (m.completed_at)
                checklistCompleted += 1;
        }
        const checklist_completion_rate = checklistTotal === 0 ? 0 : Math.round((checklistCompleted / checklistTotal) * 10000) / 10000;
        const signature_completion_rate = totalJobs === 0 ? 0 : Math.round((jobsWithSignature / totalJobs) * 10000) / 10000;
        const photo_upload_rate = totalJobs === 0 ? 0 : Math.round((jobsWithPhoto / totalJobs) * 10000) / 10000;
        const overall_rate = totalJobs === 0
            ? 0
            : Math.round(((signature_completion_rate + photo_upload_rate + checklist_completion_rate) / 3) * 10000) / 10000;
        return res.json({
            period: `${days}d`,
            signature_completion_rate,
            photo_upload_rate,
            checklist_completion_rate,
            overall_rate,
        });
    }
    catch (error) {
        console.error("Analytics compliance-rate error:", error);
        return res.status(500).json({ message: "Failed to fetch compliance rate" });
    }
});
// GET /api/analytics/job-completion — total, completed, completion_rate, avg_days to complete, on_time_rate, overdue_count
exports.analyticsRouter.get("/job-completion", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    const status = authReq.user.subscriptionStatus;
    const hasAnalytics = authReq.user.features.includes("analytics");
    const isActive = ["active", "trialing", "free"].includes(status);
    if (!isActive || !hasAnalytics) {
        return res.json({
            total: 0,
            completed: 0,
            completion_rate: 0,
            avg_days_to_complete: 0,
            on_time_rate: 0,
            overdue_count: 0,
            period: "30d",
            locked: true,
        });
    }
    try {
        const orgId = authReq.query.org_id || authReq.user.organization_id;
        if (!orgId)
            return res.status(400).json({ message: "Missing organization id" });
        const { days } = parsePeriod(authReq.query.period);
        const { since, until } = dateRangeForDays(days);
        const now = new Date().toISOString();
        const { data: jobs, error } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, status, created_at, updated_at, due_date")
            .eq("organization_id", orgId)
            .gte("created_at", since)
            .lte("created_at", until)
            .limit(MAX_FETCH_LIMIT);
        if (error)
            throw error;
        const list = (jobs || []);
        const total = list.length;
        const completedList = list.filter((j) => j.status?.toLowerCase() === "completed");
        const completed = completedList.length;
        const completion_rate = total === 0 ? 0 : Math.round((completed / total) * 10000) / 10000;
        const durations = [];
        let onTimeCount = 0;
        for (const j of completedList) {
            const completedAt = j.updated_at ?? j.created_at;
            const daysToComplete = (new Date(completedAt).getTime() - new Date(j.created_at).getTime()) / (1000 * 60 * 60 * 24);
            durations.push(daysToComplete);
            if (j.due_date && new Date(completedAt) <= new Date(j.due_date))
                onTimeCount += 1;
        }
        const avg_days_to_complete = durations.length === 0 ? 0 : Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 100) / 100;
        const on_time_rate = completed === 0 ? 0 : Math.round((onTimeCount / completed) * 10000) / 10000;
        const overdue_count = list.filter((j) => j.status?.toLowerCase() !== "completed" && j.due_date != null && j.due_date < now).length;
        return res.json({
            period: `${days}d`,
            total,
            completed,
            completion_rate,
            avg_days_to_complete,
            on_time_rate,
            overdue_count,
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
        const orgId = authReq.query.org_id || authReq.user.organization_id;
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
        const orgId = authReq.query.org_id || authReq.user.organization_id;
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
        const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
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
                ? supabaseClient_1.supabase
                    .from("mitigation_items")
                    .select("id, job_id, created_at, completed_at, completed_by")
                    .in("job_id", jobIds)
                    .order("created_at", { ascending: true })
                    .limit(MAX_FETCH_LIMIT)
                : Promise.resolve({ data: [], error: null }),
            jobIds.length
                ? supabaseClient_1.supabase
                    .from("documents")
                    .select("id, job_id, created_at")
                    .in("job_id", jobIds)
                    .order("created_at", { ascending: true })
                    .limit(MAX_FETCH_LIMIT)
                : Promise.resolve({ data: [], error: null }),
        ]);
        if (mitigationsResponse.error) {
            throw mitigationsResponse.error;
        }
        if (documentsResponse.error) {
            throw documentsResponse.error;
        }
        const mitigations = (mitigationsResponse.data || []).filter((item) => {
            if (!crewId)
                return true;
            return item.completed_by === crewId;
        });
        const documents = documentsResponse.data || [];
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
            return job.risk_score > 75;
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
        // Calculate explicit evidence metrics
        const jobsTotal = jobIds.length;
        // Jobs with photo evidence (assuming documents with type='photo' or checking file extensions)
        // For now, count all documents as photo evidence (can be refined later)
        const jobsWithPhotoEvidence = jobsWithEvidence;
        // Jobs missing required evidence - use readiness rules or default: high-risk jobs without evidence
        const highRiskJobIds = (jobs || [])
            .filter((job) => job.risk_score !== null && job.risk_score > 75)
            .map((job) => job.id);
        const highRiskJobsWithoutEvidence = highRiskJobIds.filter((jobId) => !jobEvidenceMap[jobId]).length;
        const jobsMissingRequiredEvidence = highRiskJobsWithoutEvidence;
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
        const avgTimeToFirstPhotoMinutes = avgTimeToFirstEvidenceHours * 60;
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
            avg_time_to_first_photo_minutes: avgTimeToFirstPhotoMinutes ? Number(avgTimeToFirstPhotoMinutes.toFixed(0)) : null,
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
        const orgId = authReq.query.org_id || authReq.user.organization_id;
        if (!orgId) {
            return res.status(400).json({ message: "Missing organization id" });
        }
        const rangeDays = parseRangeDays(authReq.query.range);
        const sinceDate = new Date();
        sinceDate.setHours(0, 0, 0, 0);
        sinceDate.setDate(sinceDate.getDate() - (rangeDays - 1));
        const sinceIso = sinceDate.toISOString();
        const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id, status, risk_level, created_at")
            .eq("organization_id", orgId)
            .gte("created_at", sinceIso)
            .limit(MAX_FETCH_LIMIT);
        if (jobsError)
            throw jobsError;
        const jobList = (jobs || []);
        const jobIds = jobList.map((j) => j.id);
        const [documentsResponse, mitigationsResponse] = await Promise.all([
            jobIds.length
                ? supabaseClient_1.supabase
                    .from("documents")
                    .select("id, job_id")
                    .in("job_id", jobIds)
                    .limit(MAX_FETCH_LIMIT)
                : Promise.resolve({ data: [], error: null }),
            jobIds.length
                ? supabaseClient_1.supabase
                    .from("mitigation_items")
                    .select("id, job_id, completed_at, completed_by")
                    .in("job_id", jobIds)
                    .not("completed_at", "is", null)
                    .gte("completed_at", sinceIso)
                    .limit(MAX_FETCH_LIMIT)
                : Promise.resolve({
                    data: [],
                    error: null,
                }),
        ]);
        if (documentsResponse.error)
            throw documentsResponse.error;
        if (mitigationsResponse.error)
            throw mitigationsResponse.error;
        const documents = documentsResponse.data || [];
        const completions = mitigationsResponse.data || [];
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