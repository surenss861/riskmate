/**
 * Enhanced error handling for Next.js API routes.
 * - Central error code registry for consistent, client-stable codes.
 * - ApiError class for structured thrown errors.
 * - handleApiError() to normalize caught errors and return NextResponse.
 */

import { NextResponse } from 'next/server'
import { createErrorResponse, type ApiErrorResponse } from '@/lib/utils/apiResponse'

/** Registry entry for a known API error code */
export interface ApiErrorCodeDef {
  defaultMessage: string
  statusCode: number
  retryable?: boolean
}

/**
 * Central error code registry.
 * Use these codes in createErrorResponse() and ApiError so clients can rely on stable values.
 */
export const API_ERROR_CODES = {
  UNAUTHORIZED: {
    defaultMessage: 'Unauthorized: Please log in to access this resource',
    statusCode: 401,
  },
  FORBIDDEN: {
    defaultMessage: 'You do not have permission to perform this action',
    statusCode: 403,
  },
  NOT_FOUND: {
    defaultMessage: 'The requested resource was not found',
    statusCode: 404,
  },
  VALIDATION_ERROR: {
    defaultMessage: 'Invalid request parameters',
    statusCode: 400,
  },
  RATE_LIMIT_EXCEEDED: {
    defaultMessage: 'Rate limit exceeded. Please try again later.',
    statusCode: 429,
    retryable: true,
  },
  QUERY_ERROR: {
    defaultMessage: 'A database query failed. Please try again.',
    statusCode: 500,
    retryable: true,
  },
  RLS_RECURSION_ERROR: {
    defaultMessage:
      'Database policy recursion detected. This indicates a configuration issue with row-level security policies.',
    statusCode: 500,
  },
  EXPORT_ERROR: {
    defaultMessage: 'Export failed. Please try again.',
    statusCode: 500,
    retryable: true,
  },
  INTERNAL_ERROR: {
    defaultMessage: 'An unexpected error occurred. Please try again.',
    statusCode: 500,
    retryable: true,
  },
} as const satisfies Record<string, ApiErrorCodeDef>

export type ApiErrorCode = keyof typeof API_ERROR_CODES

/**
 * Structured API error. Throw this when you know the code and want consistent handling.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode | string
  readonly statusCode: number
  readonly requestId?: string
  readonly details?: unknown
  readonly retryable?: boolean
  readonly retry_after_seconds?: number

  constructor(
    code: ApiErrorCode | string,
    options?: {
      message?: string
      statusCode?: number
      requestId?: string
      details?: unknown
      retryable?: boolean
      retry_after_seconds?: number
    }
  ) {
    const def = typeof code === 'string' && code in API_ERROR_CODES
      ? API_ERROR_CODES[code as ApiErrorCode]
      : null
    const message = options?.message ?? def?.defaultMessage ?? 'An error occurred'
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = options?.statusCode ?? def?.statusCode ?? 500
    this.requestId = options?.requestId
    this.details = options?.details
    this.retryable = options?.retryable ?? def?.retryable
    this.retry_after_seconds = options?.retry_after_seconds
    Object.setPrototypeOf(this, ApiError.prototype)
  }

  /** Build the standard JSON body for this error */
  toJson(): ApiErrorResponse {
    return createErrorResponse(this.message, this.code, {
      requestId: this.requestId,
      statusCode: this.statusCode,
      details: this.details,
      retryable: this.retryable,
      retry_after_seconds: this.retry_after_seconds,
    })
  }

  /** Build NextResponse with correct status and X-Request-ID header */
  toNextResponse(requestId: string, extraHeaders?: Record<string, string>): NextResponse {
    const body = this.toJson()
    const headers: Record<string, string> = {
      'X-Request-ID': requestId,
      ...extraHeaders,
    }
    if (this.retry_after_seconds != null) {
      headers['Retry-After'] = String(this.retry_after_seconds)
    }
    return NextResponse.json(body, { status: this.statusCode, headers })
  }
}

/**
 * Normalize an unknown caught error into an ApiError.
 * - ApiError -> return as-is (with requestId set if provided)
 * - Error with code-like property -> map to INTERNAL or use code
 * - Otherwise -> INTERNAL_ERROR, message sanitized (no stack in production)
 */
export function normalizeError(error: unknown, requestId?: string): ApiError {
  if (error instanceof ApiError) {
    if (requestId != null) {
      return new ApiError(error.code, {
        message: error.message,
        statusCode: error.statusCode,
        requestId,
        details: error.details,
        retryable: error.retryable,
        retry_after_seconds: error.retry_after_seconds,
      })
    }
    return error
  }

  const err = error instanceof Error ? error : new Error(String(error))
  const message = err.message || 'An unexpected error occurred'
  const code = (err as { code?: string }).code
  const isKnownCode =
    typeof code === 'string' && code in API_ERROR_CODES

  return new ApiError(isKnownCode ? (code as ApiErrorCode) : 'INTERNAL_ERROR', {
    message,
    requestId,
    details:
      process.env.NODE_ENV === 'development' && err.stack
        ? { stack: err.stack }
        : undefined,
  })
}

/**
 * Handle any caught error and return a NextResponse with consistent shape and headers.
 * Use in route catch blocks: return handleApiError(err, requestId)
 */
export function handleApiError(
  error: unknown,
  requestId: string,
  extraHeaders?: Record<string, string>
): NextResponse {
  const apiError = normalizeError(error, requestId)
  return apiError.toNextResponse(requestId, extraHeaders)
}
