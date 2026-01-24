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
// GET /api/dashboard/summary
// Returns aggregated dashboard data in a single call to eliminate N+1 queries
exports.dashboardRouter.get("/summary", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id } = authReq.user;
        // Fetch all jobs for the organization
        const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("*")
            .eq("organization_id", organization_id)
            .order("created_at", { ascending: false })
            .limit(100);
        if (jobsError) {
            throw jobsError;
        }
        const allJobs = jobs || [];
        // Calculate KPIs
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const jobsThisWeek = allJobs.filter((job) => {
            const createdAt = new Date(job.created_at);
            return createdAt >= weekAgo;
        }).length;
        const highRiskJobs = allJobs.filter((job) => {
            const score = job.risk_score;
            const level = job.risk_level?.toLowerCase();
            return score > 75 || level === "high" || level === "critical";
        });
        const completedJobs = allJobs.filter((job) => job.status?.toLowerCase() === "completed");
        const complianceScore = allJobs.length === 0
            ? 0
            : Math.round((completedJobs.length / allJobs.length) * 100);
        // Get jobs at risk (top 10 high-risk jobs)
        const jobsAtRisk = allJobs
            .filter((job) => {
            const score = job.risk_score;
            return score >= 70;
        })
            .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
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
        // Get missing evidence jobs (jobs with < 3 evidence items)
        // Fetch evidence counts for all jobs
        const jobIds = allJobs.slice(0, 20).map((j) => j.id);
        const { data: evidenceCounts } = await supabaseClient_1.supabase
            .from("evidence")
            .select("job_id")
            .in("job_id", jobIds)
            .eq("organization_id", organization_id);
        const evidenceByJob = {};
        evidenceCounts?.forEach((e) => {
            evidenceByJob[e.job_id] = (evidenceByJob[e.job_id] || 0) + 1;
        });
        const missingEvidenceJobs = allJobs
            .slice(0, 20)
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
        // Generate chart data (last 7 days)
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayStart = new Date(date.setHours(0, 0, 0, 0));
            const dayEnd = new Date(date.setHours(23, 59, 59, 999));
            const jobsForDay = allJobs.filter((job) => {
                const createdAt = new Date(job.created_at);
                return createdAt >= dayStart && createdAt <= dayEnd;
            });
            const completed = jobsForDay.filter((job) => job.status?.toLowerCase() === "completed");
            const compliance = jobsForDay.length === 0
                ? 0
                : (completed.length / jobsForDay.length) * 100;
            chartData.push({
                date: dayStart.toISOString().split("T")[0],
                value: Math.round(compliance),
            });
        }
        res.json({
            data: {
                kpis: {
                    complianceScore,
                    complianceTrend: "neutral",
                    openRisks: highRiskJobs.length,
                    risksTrend: "neutral",
                    jobsThisWeek,
                    jobsTrend: "neutral",
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