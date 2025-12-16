import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Middleware to generate and attach request IDs to all requests/responses
 * Also propagates W3C Trace Context (trace_parent) for enterprise observability
 * Makes correlating audit logs + support tickets trivial
 */
export interface RequestWithId extends Request {
  requestId?: string;
  traceParent?: string;
}

/**
 * Parse W3C Trace Context header (trace_parent)
 * Format: 00-{trace_id}-{parent_id}-{flags}
 * We propagate it but don't modify it (let upstream services handle trace creation)
 */
function parseTraceParent(header: string | undefined): string | null {
  if (!header) return null;
  
  // Basic validation: should be 55 chars (00-{32 hex}-{16 hex}-{2 hex})
  if (header.length !== 55 || !header.match(/^00-[a-f0-9]{32}-[a-f0-9]{16}-[a-f0-9]{2}$/i)) {
    return null;
  }
  
  return header;
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Generate request ID (use existing header if present, otherwise generate new)
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  (req as RequestWithId).requestId = requestId;
  
  // Propagate W3C Trace Context if present (for enterprise observability stacks)
  // Explicitly echo traceparent header for correlation (some tracing systems grab headers faster than body fields)
  const traceParent = parseTraceParent(req.headers['traceparent'] as string);
  if (traceParent) {
    (req as RequestWithId).traceParent = traceParent;
    res.setHeader('traceparent', traceParent); // Explicit echo for correlation
    res.setHeader('X-Traceparent', traceParent); // Also set X-Traceparent for systems that prefer X- prefix
  }
  
  // Attach to response header for client correlation
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

