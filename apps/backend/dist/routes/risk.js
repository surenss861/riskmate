"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.riskRouter = void 0;
const express_1 = __importDefault(require("express"));
const supabaseClient_1 = require("../lib/supabaseClient");
const auth_1 = require("../middleware/auth");
exports.riskRouter = express_1.default.Router();
// GET /api/risk/factors
// Returns all available risk factors for job creation
exports.riskRouter.get("/factors", auth_1.authenticate, async (req, res) => {
    try {
        const { data: factors, error } = await supabaseClient_1.supabase
            .from("risk_factors")
            .select("id, code, name, description, severity, category")
            .eq("is_active", true)
            .order("severity", { ascending: false })
            .order("name", { ascending: true });
        if (error)
            throw error;
        res.json({ data: factors || [] });
    }
    catch (err) {
        console.error("Risk factors fetch failed:", err);
        res.status(500).json({ message: "Failed to fetch risk factors" });
    }
});
// GET /api/risk/summary
// Returns top 3 hazards for organization in last 30 days
exports.riskRouter.get("/summary", auth_1.authenticate, async (req, res) => {
    const authReq = req;
    try {
        const { organization_id } = authReq.user;
        // Get jobs from last 30 days for this organization
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: jobs, error: jobsError } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id")
            .eq("organization_id", organization_id)
            .gte("created_at", thirtyDaysAgo.toISOString());
        if (jobsError)
            throw jobsError;
        if (!jobs || jobs.length === 0) {
            return res.json({ hazards: [] });
        }
        const jobIds = jobs.map((j) => j.id);
        // Get risk scores for these jobs
        const { data: riskScores, error: riskError } = await supabaseClient_1.supabase
            .from("job_risk_scores")
            .select("factors")
            .in("job_id", jobIds);
        if (riskError)
            throw riskError;
        // Aggregate hazard counts from risk factors
        const hazardCounts = {};
        riskScores?.forEach((score) => {
            if (score.factors && Array.isArray(score.factors)) {
                score.factors.forEach((factor) => {
                    const code = factor.code || factor.factor_id;
                    const name = factor.name || code;
                    const severity = factor.severity || "medium";
                    if (!hazardCounts[code]) {
                        hazardCounts[code] = {
                            count: 0,
                            severity,
                            code,
                        };
                    }
                    hazardCounts[code].count += 1;
                });
            }
        });
        // Get risk factor details for names
        const codes = Object.keys(hazardCounts);
        if (codes.length > 0) {
            const { data: riskFactors } = await supabaseClient_1.supabase
                .from("risk_factors")
                .select("code, name, severity")
                .in("code", codes);
            // Map to final format
            const hazards = riskFactors
                ?.map((factor) => {
                const countInfo = hazardCounts[factor.code];
                if (!countInfo)
                    return null;
                return {
                    code: factor.code,
                    name: factor.name,
                    count: countInfo.count,
                    severity: factor.severity,
                };
            })
                .filter((h) => h !== null)
                .sort((a, b) => b.count - a.count)
                .slice(0, 3) || [];
            return res.json({ hazards });
        }
        res.json({ hazards: [] });
    }
    catch (err) {
        console.error("Error fetching heatmap:", err);
        res.status(500).json({ message: "Failed to fetch hazard summary" });
    }
});
//# sourceMappingURL=risk.js.map