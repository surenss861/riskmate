"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const supabaseClient_1 = require("../lib/supabaseClient");
const legal_1 = require("../utils/legal");
const planRules_1 = require("../auth/planRules");
async function loadPlanForOrganization(organizationId) {
    const { data } = await supabaseClient_1.supabase
        .from("org_subscriptions")
        .select("plan_code, seats_limit, jobs_limit_month")
        .eq("organization_id", organizationId)
        .maybeSingle();
    if (!data?.plan_code) {
        return {
            planCode: "starter",
            status: "none",
            seatsLimit: 0,
            jobsMonthlyLimit: 0,
            features: [],
        };
    }
    const planCode = data.plan_code;
    const limits = (0, planRules_1.limitsFor)(planCode);
    // Default to active if status column doesn't exist yet
    const status = "active";
    const isActive = true;
    return {
        planCode,
        status,
        seatsLimit: isActive ? data.seats_limit ?? limits.seats ?? null : 0,
        jobsMonthlyLimit: isActive ? data.jobs_limit_month ?? limits.jobsMonthly ?? null : 0,
        features: isActive ? limits.features : [],
    };
}
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized - No token provided" });
        }
        const token = authHeader.split("Bearer ")[1];
        if (!token) {
            return res.status(401).json({ message: "Unauthorized - Invalid token format" });
        }
        const { data: authData, error: authError } = await supabaseClient_1.supabase.auth.getUser(token);
        if (authError || !authData?.user) {
            return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }
        const userId = authData.user.id;
        const { data: userRecord, error: userError } = await supabaseClient_1.supabase
            .from("users")
            .select("id, organization_id, email, role, archived_at, must_reset_password")
            .eq("id", userId)
            .maybeSingle();
        if (userError || !userRecord?.organization_id) {
            return res.status(401).json({ message: "Unauthorized - User not found" });
        }
        if (userRecord.archived_at) {
            return res.status(403).json({ message: "Account disabled" });
        }
        const organizationId = userRecord.organization_id;
        const email = userRecord.email ?? authData.user.email ?? undefined;
        const role = userRecord.role ?? undefined;
        const mustResetPassword = Boolean(userRecord.must_reset_password);
        const planInfo = await loadPlanForOrganization(organizationId);
        const planCode = planInfo.planCode;
        const seatsLimit = planInfo.seatsLimit;
        const jobsMonthlyLimit = planInfo.jobsMonthlyLimit;
        const features = planInfo.features;
        const subscriptionStatus = planInfo.status;
        const { data: legalAcceptance } = await supabaseClient_1.supabase
            .from("legal_acceptances")
            .select("accepted_at")
            .eq("user_id", userId)
            .eq("version", legal_1.LEGAL_VERSION)
            .order("accepted_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        const legalAccepted = Boolean(legalAcceptance?.accepted_at);
        const path = req.originalUrl || req.url;
        if (!legalAccepted && !path.startsWith("/api/legal")) {
            return res.status(428).json({
                message: "Legal terms not accepted",
                code: "LEGAL_ACCEPTANCE_REQUIRED",
                version: legal_1.LEGAL_VERSION,
            });
        }
        req.user = {
            id: userId,
            organization_id: organizationId,
            email,
            role,
            mustResetPassword,
            plan: planCode,
            seatsLimit,
            jobsMonthlyLimit,
            features,
            subscriptionStatus,
            legalAccepted,
            legalAcceptedAt: legalAcceptance?.accepted_at ?? null,
        };
        next();
    }
    catch (err) {
        console.error("Auth middleware error:", err);
        return res.status(500).json({ message: "Authentication error" });
    }
};
exports.authenticate = authenticate;
//# sourceMappingURL=auth.js.map