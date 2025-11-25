import { NextFunction, Response } from "express";
import { supabase } from "../lib/supabaseClient";
import { AuthenticatedRequest } from "./auth";
import { PlanFeature } from "../auth/planRules";

const ACTIVE_STATUSES = new Set(["active", "trialing", "free"]);

export function requireFeature(feature: PlanFeature) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const status = req.user.subscriptionStatus;
    if (!ACTIVE_STATUSES.has(status)) {
      return res.status(402).json({
        message: "Your subscription is not active. Please update billing to unlock this feature.",
        code: status === "past_due" ? "PLAN_PAST_DUE" : "PLAN_INACTIVE",
      });
    }

    if (!req.user.features.includes(feature)) {
      return res.status(403).json({
        message: "Feature not available on your plan",
        code: "FEATURE_NOT_ALLOWED",
        feature,
      });
    }
    next();
  };
}

export async function enforceJobLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const status = req.user.subscriptionStatus;
    if (status === "past_due" || status === "canceled") {
      return res.status(402).json({
        message: "Your subscription is not active. Update billing to create new jobs.",
        code: "PLAN_INACTIVE",
      });
    }

    const limit = req.user.jobsMonthlyLimit;
    if (limit === 0) {
      return res.status(403).json({
        message: "Your current plan does not allow job creation. Please upgrade your plan.",
        code: "JOB_LIMIT_REACHED",
        limit,
      });
    }

    if (!limit) {
      return next();
    }

    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", req.user.organization_id)
      .gte("created_at", periodStart.toISOString());

    if (error) {
      console.error("Job limit check failed:", error);
      return res.status(500).json({ message: "Failed to enforce job limit" });
    }

    if ((count ?? 0) >= limit) {
      return res.status(403).json({
        message: "Plan job limit reached. Upgrade your plan to create more jobs.",
        code: "JOB_LIMIT_REACHED",
        limit,
      });
    }

    next();
  } catch (err) {
    console.error("Job limit enforcement error:", err);
    res.status(500).json({ message: "Failed to enforce job limit" });
  }
}
