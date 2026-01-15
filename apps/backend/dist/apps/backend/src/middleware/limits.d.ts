import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./auth";
import { PlanFeature } from "../auth/planRules";
import { RequestWithId } from "./requestId";
export declare function requireFeature(feature: PlanFeature): (req: AuthenticatedRequest & RequestWithId, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function enforceJobLimit(req: AuthenticatedRequest & RequestWithId, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=limits.d.ts.map