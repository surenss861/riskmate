/**
 * Rate Limiting Middleware
 *
 * Protects expensive operations (exports, uploads, verification) from abuse
 * Uses in-memory store (simple) or can be upgraded to Redis for multi-instance
 */
import { Request, Response, NextFunction } from 'express';
interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
/**
 * Create a rate limiter middleware
 */
export declare function createRateLimiter(config: RateLimitConfig): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const exportRateLimiter: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const uploadRateLimiter: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const verificationRateLimiter: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export {};
//# sourceMappingURL=rateLimiter.d.ts.map