import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Middleware to generate and attach request IDs to all requests/responses
 * Makes correlating audit logs + support tickets trivial
 */
export interface RequestWithId extends Request {
  requestId?: string;
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate request ID (use existing header if present, otherwise generate new)
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as RequestWithId).requestId = requestId;
  
  // Attach to response header for client correlation
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

