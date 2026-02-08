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
import { getOrganizationContext } from '@/lib/utils/organizationGuard'

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

/**
 * Run cleanup of expired entries. Used by the interval and by tests.
 */
export function runCleanup(): void {
  const now = Date.now()
  for (const key of Object.keys(rateLimitStore)) {
    if (rateLimitStore[key].resetAt < now) {
      delete rateLimitStore[key]
    }
  }
}

function scheduleCleanup(): void {
  if (cleanupScheduled) return
  // Skip interval in test env to avoid Jest "open handles" (tests pass, process exits)
  if (process.env.NODE_ENV === 'test') return
  cleanupScheduled = true
  setInterval(runCleanup, CLEANUP_INTERVAL_MS)
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
 * Check rate limit for a request. Resolves organization and user from the request
 * via getOrganizationContext, then applies the rate limit.
 *
 * @param request - NextRequest (used for pathname and auth)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with allowed status and header values (limit, remaining, resetAt, retryAfter)
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const context = await getOrganizationContext(request)
  return checkRateLimitWithContext(request, config, context)
}

/**
 * Check rate limit with explicit context. Use when you already have org/user
 * (e.g. in tests or after getOrganizationContext elsewhere).
 */
export function checkRateLimitWithContext(
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
 * Pre-configured rate limit configs for API routes.
 * Use with checkRateLimit(request, { ...RATE_LIMIT_CONFIGS.export }).
 */
export const RATE_LIMIT_CONFIGS = {
  export: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'export',
  },
  pdf: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'pdf',
  },
  bulk: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: 'bulk',
  },
  mutation: {
    windowMs: 60 * 1000,
    maxRequests: 120,
    keyPrefix: 'mutation',
  },
} as const

/**
 * Pre-configured rate limit configs with optional env overrides (export, pdf).
 * @deprecated Prefer RATE_LIMIT_CONFIGS for new code.
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
