"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFeature = requireFeature;
exports.enforceJobLimit = enforceJobLimit;
const supabaseClient_1 = require("../lib/supabaseClient");
const errorResponse_1 = require("../utils/errorResponse");
const ACTIVE_STATUSES = new Set(["active", "trialing", "free"]);
function requireFeature(feature) {
    return (req, res, next) => {
        const requestId = req.requestId || 'unknown';
        const organizationId = req.user.organization_id;
        const status = req.user.subscriptionStatus;
        if (!ACTIVE_STATUSES.has(status)) {
            const code = status === "past_due" ? "ENTITLEMENTS_PLAN_PAST_DUE" : "ENTITLEMENTS_PLAN_INACTIVE";
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: "Your subscription is not active. Please update billing to unlock this feature.",
                internalMessage: `Feature access denied: subscription_status=${status}, feature=${feature}`,
                code,
                requestId,
                statusCode: 402,
                subscription_status: status,
                feature,
            });
            // Set error ID in response header
            res.setHeader('X-Error-ID', errorId);
            (0, errorResponse_1.logErrorForSupport)(402, code, requestId, organizationId, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, req.path);
            return res.status(402).json(errorResponse);
        }
        if (!req.user.features.includes(feature)) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: "Feature not available on your plan",
                internalMessage: `Feature access denied: feature=${feature}, plan=${req.user.plan}`,
                code: "ENTITLEMENTS_FEATURE_NOT_ALLOWED",
                requestId,
                statusCode: 403,
                feature,
                plan: req.user.plan,
            });
            // Set error ID in response header
            res.setHeader('X-Error-ID', errorId);
            (0, errorResponse_1.logErrorForSupport)(403, "ENTITLEMENTS_FEATURE_NOT_ALLOWED", requestId, organizationId, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, req.path);
            return res.status(403).json(errorResponse);
        }
        next();
    };
}
async function enforceJobLimit(req, res, next) {
    try {
        const requestId = req.requestId || 'unknown';
        const organizationId = req.user.organization_id;
        const status = req.user.subscriptionStatus;
        if (status === "past_due" || status === "canceled") {
            const code = status === "past_due" ? "ENTITLEMENTS_PLAN_PAST_DUE" : "ENTITLEMENTS_PLAN_INACTIVE";
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: "Your subscription is not active. Update billing to create new jobs.",
                internalMessage: `Job creation blocked: subscription_status=${status}`,
                code,
                requestId,
                statusCode: 402,
                subscription_status: status,
            });
            // Set error ID in response header
            res.setHeader('X-Error-ID', errorId);
            (0, errorResponse_1.logErrorForSupport)(402, code, requestId, organizationId, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, req.path);
            return res.status(402).json(errorResponse);
        }
        const limit = req.user.jobsMonthlyLimit;
        if (limit === 0) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: "Your current plan does not allow job creation. Please upgrade your plan.",
                internalMessage: `Job limit check: limit=${limit}, plan=${req.user.plan}`,
                code: "ENTITLEMENTS_JOB_LIMIT_REACHED",
                requestId,
                statusCode: 403,
                limit,
                plan: req.user.plan,
            });
            // Set error ID in response header
            res.setHeader('X-Error-ID', errorId);
            (0, errorResponse_1.logErrorForSupport)(403, "ENTITLEMENTS_JOB_LIMIT_REACHED", requestId, organizationId, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, req.path);
            return res.status(403).json(errorResponse);
        }
        if (!limit) {
            return next();
        }
        const periodStart = new Date();
        periodStart.setUTCDate(1);
        periodStart.setUTCHours(0, 0, 0, 0);
        const { count, error } = await supabaseClient_1.supabase
            .from("jobs")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", req.user.organization_id)
            .gte("created_at", periodStart.toISOString());
        if (error) {
            console.error("Job limit check failed:", error);
            return res.status(500).json({ message: "Failed to enforce job limit" });
        }
        if ((count ?? 0) >= limit) {
            const { response: errorResponse, errorId } = (0, errorResponse_1.createErrorResponse)({
                message: "Plan job limit reached. Upgrade your plan to create more jobs.",
                internalMessage: `Job limit exceeded: limit=${limit}, current=${count || 0}, plan=${req.user.plan}`,
                code: "ENTITLEMENTS_JOB_LIMIT_REACHED",
                requestId,
                statusCode: 403,
                limit,
                current_count: count || 0,
                plan: req.user.plan,
            });
            // Set error ID in response header
            res.setHeader('X-Error-ID', errorId);
            (0, errorResponse_1.logErrorForSupport)(403, "ENTITLEMENTS_JOB_LIMIT_REACHED", requestId, organizationId, errorResponse.message, errorResponse.internal_message, errorResponse.category, errorResponse.severity, req.path);
            return res.status(403).json(errorResponse);
        }
        next();
    }
    catch (err) {
        console.error("Job limit enforcement error:", err);
        res.status(500).json({ message: "Failed to enforce job limit" });
    }
}
//# sourceMappingURL=limits.js.map