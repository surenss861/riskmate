import { type RequestHandler } from "express";
/**
 * Middleware to enforce read-only access for auditors and executives
 * Blocks all write operations (POST, PATCH, DELETE) for read-only roles
 *
 * Fails closed: Returns 401 if auth context is missing
 * Uses consistent error format with X-Error-ID header
 * Logs violations to audit trail
 */
export declare const requireWriteAccess: RequestHandler;
//# sourceMappingURL=requireWriteAccess.d.ts.map