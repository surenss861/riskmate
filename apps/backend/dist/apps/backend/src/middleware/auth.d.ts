import { Request, Response, NextFunction } from "express";
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
export declare const authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=auth.d.ts.map