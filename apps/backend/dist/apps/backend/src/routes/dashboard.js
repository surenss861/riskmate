"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
exports.dashboardRouter = express_1.default.Router();
const PERIOD_DAYS = { "7d": 7, "30d": 30 };
function parsePeriod(value) {
    const str = value ? (Array.isArray(value) ? value[0] : value) : "30d";
    const key = (str === "7d" || str === "30d" ? str : "30d");
    return { days: PERIOD_DAYS[key], key };
}
function dateRangeForDays(days) {
    const until = new Date();
    until.setHours(23, 59, 59, 999);
    const since = new Date(until.getTime());
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);
    return { since: since.toISOString(), until: until.toISOString() };
}
function trendFromValues(current, previous) {
    if (previous === 0) {
        return { trend_direction: current > 0 ? "up" : "flat", trend_percentage: current > 0 ? 100 : 0 };
    }
    const pct = ((current - previous) / previous) * 100;
    const trend_direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
    return { trend_direction, trend_percentage: Math.round(Math.abs(pct) * 100) / 100 };
}
// GET /api/dashboard/summary
// Accepts period=7d|30d. Returns KPIs via server-side RPCs (no full job/document scans). Trend vs previous period; includes on-time/overdue.
exports.dashboardRouter.get("/summary", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id } = authReq.user;
        const { days, key: periodKey } = parsePeriod(req.query.period);
        const { since: currentSince, until: currentUntil } = dateRangeForDays(days);
        const previousEnd = new Date(currentSince);
        previousEnd.setMilliseconds(previousEnd.getMilliseconds() - 1);
        const previousSince = new Date(previousEnd.getTime());
        previousSince.setDate(previousSince.getDate() - (days - 1));
        previousSince.setHours(0, 0, 0, 0);
        const previousRange = { since: previousSince.toISOString(), until: previousEnd.toISOString() };
        const chartDays = 7;
        const chartUntil = new Date();
        chartUntil.setHours(23, 59, 59, 999);
        const chartSince = new Date(chartUntil.getTime());
        chartSince.setDate(chartSince.getDate() - (chartDays - 1));
        chartSince.setHours(0, 0, 0, 0);
        const [currentSummaryRes, previousSummaryRes, currentComplianceRes, previousComplianceRes, jobsAtRiskRes, missingEvidenceRes, chartDataRes,] = await Promise.all([
            supabaseClient_1.supabase.rpc("get_dashboard_summary_kpis", {
                p_org_id: organization_id,
                p_since: currentSince,
                p_until: currentUntil,
            }),
            supabaseClient_1.supabase.rpc("get_dashboard_summary_kpis", {
                p_org_id: organization_id,
                p_since: previousRange.since,
                p_until: previousRange.until,
            }),
            supabaseClient_1.supabase.rpc("get_compliance_rate_kpis", {
                p_org_id: organization_id,
                p_since: currentSince,
                p_until: currentUntil,
            }),
            supabaseClient_1.supabase.rpc("get_compliance_rate_kpis", {
                p_org_id: organization_id,
                p_since: previousRange.since,
                p_until: previousRange.until,
            }),
            supabaseClient_1.supabase.rpc("get_dashboard_jobs_at_risk", {
                p_org_id: organization_id,
                p_since: currentSince,
                p_until: currentUntil,
                p_limit: 10,
            }),
            supabaseClient_1.supabase.rpc("get_dashboard_missing_evidence_jobs", {
                p_org_id: organization_id,
                p_since: currentSince,
                p_until: currentUntil,
                p_limit: 10,
            }),
            supabaseClient_1.supabase.rpc("get_dashboard_chart_data", {
                p_org_id: organization_id,
                p_since: chartSince.toISOString(),
                p_until: chartUntil.toISOString(),
            }),
        ]);
        if (currentSummaryRes.error)
            throw currentSummaryRes.error;
        if (previousSummaryRes.error)
            throw previousSummaryRes.error;
        if (currentComplianceRes.error)
            throw currentComplianceRes.error;
        if (previousComplianceRes.error)
            throw previousComplianceRes.error;
        if (jobsAtRiskRes.error)
            throw jobsAtRiskRes.error;
        if (missingEvidenceRes.error)
            throw missingEvidenceRes.error;
        if (chartDataRes.error)
            throw chartDataRes.error;
        const currentRow = Array.isArray(currentSummaryRes.data) ? currentSummaryRes.data[0] : currentSummaryRes.data;
        const previousRow = Array.isArray(previousSummaryRes.data) ? previousSummaryRes.data[0] : previousSummaryRes.data;
        const jobs_total = Number(currentRow?.jobs_total ?? 0);
        const jobs_completed = Number(currentRow?.jobs_completed ?? 0);
        const completion_rate = jobs_total === 0 ? 0 : Math.round((jobs_completed / jobs_total) * 10000) / 100;
        const avg_risk = Number(currentRow?.avg_risk ?? 0);
        const on_time_count = Number(currentRow?.on_time_count ?? 0);
        const overdue_count = Number(currentRow?.overdue_count ?? 0);
        const currentKpis = Array.isArray(currentComplianceRes.data) ? currentComplianceRes.data[0] : currentComplianceRes.data;
        const previousKpis = Array.isArray(previousComplianceRes.data) ? previousComplianceRes.data[0] : previousComplianceRes.data;
        const totalCurrent = Number(currentKpis?.total_jobs ?? 0);
        const totalPrevious = Number(previousKpis?.total_jobs ?? 0);
        const compliance_rate_fraction = totalCurrent === 0
            ? 0
            : ((Number(currentKpis?.jobs_with_signature ?? 0) / totalCurrent) +
                (Number(currentKpis?.jobs_with_photo ?? 0) / totalCurrent) +
                (Number(currentKpis?.jobs_checklist_complete ?? 0) / totalCurrent)) /
                3;
        const prev_compliance_rate_fraction = totalPrevious === 0
            ? 0
            : ((Number(previousKpis?.jobs_with_signature ?? 0) / totalPrevious) +
                (Number(previousKpis?.jobs_with_photo ?? 0) / totalPrevious) +
                (Number(previousKpis?.jobs_checklist_complete ?? 0) / totalPrevious)) /
                3;
        const compliance_rate = Math.round(compliance_rate_fraction * 10000) / 100;
        const prev_compliance_rate = Math.round(prev_compliance_rate_fraction * 10000) / 100;
        const prev_total = Number(previousRow?.jobs_total ?? 0);
        const prev_completed = Number(previousRow?.jobs_completed ?? 0);
        const prev_completion_rate = prev_total === 0 ? 0 : Math.round((prev_completed / prev_total) * 10000) / 100;
        const prev_avg_risk = Number(previousRow?.avg_risk ?? 0);
        const trend_vs_previous = {
            jobs_total: trendFromValues(jobs_total, prev_total),
            jobs_completed: trendFromValues(jobs_completed, prev_completed),
            completion_rate: trendFromValues(completion_rate, prev_completion_rate),
            avg_risk: trendFromValues(avg_risk, prev_avg_risk),
            compliance_rate: trendFromValues(compliance_rate, prev_compliance_rate),
        };
        const jobsAtRisk = (jobsAtRiskRes.data ?? []).map((job) => ({
            id: job.id,
            client_name: job.client_name ?? undefined,
            job_type: job.job_type ?? undefined,
            location: job.location ?? undefined,
            status: job.status ?? undefined,
            risk_score: job.risk_score ?? undefined,
            risk_level: job.risk_level ?? undefined,
            created_at: job.created_at,
        }));
        const missingEvidenceJobs = (missingEvidenceRes.data ?? []).map((job) => ({
            id: job.id,
            client_name: job.client_name ?? undefined,
            job_type: job.job_type ?? undefined,
            location: job.location ?? undefined,
            status: job.status ?? undefined,
            risk_score: job.risk_score ?? undefined,
            risk_level: job.risk_level ?? undefined,
            created_at: job.created_at,
        }));
        const chartRows = (chartDataRes.data ?? []);
        const chartByDate = new Map();
        for (const r of chartRows) {
            const dateStr = typeof r.period_key === "string" ? r.period_key.slice(0, 10) : new Date(r.period_key).toISOString().slice(0, 10);
            chartByDate.set(dateStr, { jobs_created: Number(r.jobs_created ?? 0), jobs_completed: Number(r.jobs_completed ?? 0) });
        }
        const chartData = [];
        for (let i = chartDays - 1; i >= 0; i--) {
            const d = new Date(chartUntil.getTime() - i * 24 * 60 * 60 * 1000);
            d.setHours(0, 0, 0, 0);
            const dateStr = d.toISOString().split("T")[0];
            const cur = chartByDate.get(dateStr) ?? { jobs_created: 0, jobs_completed: 0 };
            // Same-cohort rate from RPC (jobs_completed ≤ jobs_created); clamp 0–100 for safety
            const ratePct = cur.jobs_created === 0 ? 0 : (cur.jobs_completed / cur.jobs_created) * 100;
            const value = Math.min(100, Math.max(0, Math.round(ratePct)));
            chartData.push({ date: dateStr, value });
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
    }
    catch (err) {
        console.error("[Dashboard] Summary fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch dashboard summary" });
    }
});
// GET /api/dashboard/top-hazards
// Returns aggregated top hazards without per-job loops
exports.dashboardRouter.get("/top-hazards", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id } = authReq.user;
        // Fetch mitigation items (hazards) for all jobs
        const { data: mitigationItems, error: mitigationError } = await supabaseClient_1.supabase
            .from("mitigation_items")
            .select("factor_id, title, code")
            .eq("organization_id", organization_id)
            .limit(1000);
        if (mitigationError) {
            throw mitigationError;
        }
        // Count occurrences by code/factor_id
        const hazardCounts = {};
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
    }
    catch (err) {
        console.error("[Dashboard] Top hazards fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch top hazards" });
    }
});
//# sourceMappingURL=dashboard.js.map