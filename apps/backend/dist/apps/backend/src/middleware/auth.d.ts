import { Request, type RequestHandler } from "express";
import { PlanCode } from "../auth/planRules";
export interface AuthenticatedUser {
    id: string;
    organization_id: string;
    email?: string;
    role?: string;
    mustResetPassword: boolean;
    plan: PlanCode;
    seatsLimit: number | null;
    jobsMonthlyLimit: number | null;
    features: string[];
    subscriptionStatus: string;
    legalAccepted: boolean;
    legalAcceptedAt?: string | null;
}
export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}
/**
 * Express RequestHandler wrapper for authenticate middleware
 * Properly typed to avoid 'as unknown as RequestHandler' casts
 */
export declare const authenticate: RequestHandler;
//# sourceMappingURL=auth.d.ts.map