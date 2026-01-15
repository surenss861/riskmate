/**
 * Rate Limiting Middleware
 * 
 * Protects expensive operations (exports, uploads, verification) from abuse
 * Uses in-memory store (simple) or can be upgraded to Redis for multi-instance
 */

import { Request, Response, NextFunction } from 'express'
import { AuthenticatedRequest } from './auth'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  message?: string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

// In-memory store (simple, works for single instance)
// For multi-instance, use Redis or similar
const rateLimitStore: RateLimitStore = {}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetAt < now) {
      delete rateLimitStore[key]
    }
  }
}, 5 * 60 * 1000)

/**
 * Create a rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest
    const organizationId = authReq.user?.organization_id || 'anonymous'
    const userId = authReq.user?.id || req.ip || 'unknown'
    
    // Create key: org_id:user_id:endpoint
    const endpoint = req.path
    const key = `${organizationId}:${userId}:${endpoint}`
    
    const now = Date.now()
    const entry = rateLimitStore[key]
    
    // Reset if window expired
    if (!entry || entry.resetAt < now) {
      rateLimitStore[key] = {
        count: 1,
        resetAt: now + config.windowMs,
      }
      return next()
    }
    
    // Check limit
    if (entry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.setHeader('X-RateLimit-Limit', String(config.maxRequests))
      res.setHeader('X-RateLimit-Remaining', '0')
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))
      res.setHeader('Retry-After', String(retryAfter))
      
      return res.status(429).json({
        error: {
          message: config.message || 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retry_after_seconds: retryAfter,
          hint: `Try again in ${retryAfter} seconds`,
        },
      })
    }
    
    // Increment counter
    entry.count++
    res.setHeader('X-RateLimit-Limit', String(config.maxRequests))
    res.setHeader('X-RateLimit-Remaining', String(config.maxRequests - entry.count))
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))
    
    next()
  }
}

// Pre-configured rate limiters
export const exportRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 exports per hour per org
  message: 'Export rate limit exceeded. Please try again later.',
})

export const uploadRateLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRequests: 100, // 100 uploads per day per org
  message: 'Upload rate limit exceeded. Please try again tomorrow.',
})

export const verificationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 verifications per minute
  message: 'Verification rate limit exceeded. Please try again in a moment.',
})

// Per-org concurrent export limiter (checked in worker)
// Note: This is imported where needed to avoid circular dependencies
