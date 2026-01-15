import { Request, Response, NextFunction } from "express";
/**
 * Middleware to generate and attach request IDs to all requests/responses
 * Also propagates W3C Trace Context (trace_parent) for enterprise observability
 * Makes correlating audit logs + support tickets trivial
 */
export interface RequestWithId extends Request {
    requestId?: string;
    traceParent?: string;
}
export declare const requestIdMiddleware: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=requestId.d.ts.map