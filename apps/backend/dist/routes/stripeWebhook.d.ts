import type { Request, Response } from "express";
import { PlanCode } from "../auth/planRules";
export declare function applyPlanToOrganization(organizationId: string, plan: PlanCode, options: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    currentPeriodStart?: number | null;
    currentPeriodEnd?: number | null;
    status?: string | null;
    seatsLimitOverride?: number | null;
    jobsLimitOverride?: number | null;
}): Promise<void>;
export declare function stripeWebhookHandler(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=stripeWebhook.d.ts.map