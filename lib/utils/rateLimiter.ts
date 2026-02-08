/**
 * Rate Limiting Utility for Next.js API Routes
 *
 * Protects expensive operations (exports, PDF generation) from abuse.
 * Uses in-memory store - suitable for single instance. For horizontal scaling,
 * replace with Redis-based store.
 *
 * @see apps/backend/src/middleware/rateLimiter.ts - Express backend reference
 */

import { NextRequest } from 'next/server'

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
}

export interface RateLimitContext {
  organization_id: string
  user_id: string
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfter: number
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store. Key format: "prefix:org_id:user_id:endpoint"
const rateLimitStore: Record<string, RateLimitEntry> = {}

// Cleanup old entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let cleanupScheduled = false

function scheduleCleanup(): void {
  if (cleanupScheduled) return
  // Skip interval in test env to avoid Jest "open handles" (tests pass, process exits)
  if (process.env.NODE_ENV === 'test') return
  cleanupScheduled = true
  setInterval(() => {
    const now = Date.now()
    for (const key of Object.keys(rateLimitStore)) {
      if (rateLimitStore[key].resetAt < now) {
        delete rateLimitStore[key]
      }
    }
  }, CLEANUP_INTERVAL_MS)
}

/**
 * Build rate limit key from context and endpoint
 */
function buildKey(
  prefix: string,
  organizationId: string,
  userId: string,
  pathname: string
): string {
  return `${prefix}:${organizationId}:${userId}:${pathname}`
}

/**
 * Check rate limit for a request. Call after authentication to ensure
 * org and user context are available.
 *
 * @param request - NextRequest for pathname
 * @param config - Rate limit configuration
 * @param context - Authenticated org and user (from getOrganizationContext or similar)
 * @returns RateLimitResult with allowed status and headers info
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  context: RateLimitContext
): RateLimitResult {
  scheduleCleanup()

  const prefix = config.keyPrefix ?? 'default'
  const pathname = request.nextUrl?.pathname ?? request.url ?? '/'
  const key = buildKey(
    prefix,
    context.organization_id,
    context.user_id,
    pathname
  )

  const now = Date.now()
  let entry = rateLimitStore[key]

  // Reset if window expired or new entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    }
    rateLimitStore[key] = entry

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetAt: Math.ceil(entry.resetAt / 1000),
      retryAfter: Math.ceil(config.windowMs / 1000),
      windowMs: config.windowMs,
    }
  }

  // Check limit
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      allowed: false,
      limit: config.maxRequests,
      remaining: 0,
      resetAt: Math.ceil(entry.resetAt / 1000),
      retryAfter,
      windowMs: config.windowMs,
    }
  }

  // Increment counter
  entry.count++

  return {
    allowed: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetAt: Math.ceil(entry.resetAt / 1000),
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    windowMs: config.windowMs,
  }
}

/**
 * Pre-configured rate limit configs per spec
 */
export const RATE_LIMIT_PRESETS = {
  export: {
    windowMs: parseInt(
      process.env.RATE_LIMIT_EXPORT_WINDOW_MS || String(60 * 60 * 1000),
      10
    ),
    maxRequests: parseInt(
      process.env.RATE_LIMIT_EXPORT_MAX_REQUESTS || '10',
      10
    ),
    keyPrefix: 'export',
  },
  pdf: {
    windowMs: parseInt(
      process.env.RATE_LIMIT_PDF_WINDOW_MS || String(60 * 60 * 1000),
      10
    ),
    maxRequests: parseInt(
      process.env.RATE_LIMIT_PDF_MAX_REQUESTS || '20',
      10
    ),
    keyPrefix: 'pdf',
  },
} as const
