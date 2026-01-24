import { type RequestHandler } from "express";
import { PlanFeature } from "../auth/planRules";
/**
 * Express RequestHandler wrapper for requireFeature middleware
 * Properly typed to avoid 'as unknown as RequestHandler' casts
 */
export declare function requireFeature(feature: PlanFeature): RequestHandler;
/**
 * Express RequestHandler wrapper for enforceJobLimit middleware
 * Properly typed to avoid 'as unknown as RequestHandler' casts
 */
export declare const enforceJobLimit: RequestHandler;
//# sourceMappingURL=limits.d.ts.map