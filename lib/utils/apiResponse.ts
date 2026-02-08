import { randomUUID } from 'crypto'
import { ERROR_CODE_REGISTRY, ERROR_CLASSIFICATIONS, ERROR_CATEGORIES } from '@/lib/utils/errorCodes'

/**
 * Standard API response schemas
 * Ensures consistent error and success responses across all endpoints
 */

export interface ApiSuccessResponse<T = any> {
  ok: true
  data?: T
  count?: number
  message?: string
  [key: string]: any // Allow additional fields
}

export interface ApiErrorResponse {
  ok: false
  message: string
  code: string
  requestId?: string
  request_id?: string
  details?: any
  error_id?: string
  severity?: 'error' | 'warn' | 'info'
  category?: string
  classification?: string
  retryable?: boolean
  retry_strategy?: 'none' | 'immediate' | 'exponential_backoff' | 'after_retry_after'
  error_hint?: string | null
  support_url?: string
  retry_after_seconds?: number
  [key: string]: any // Allow additional fields
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T, options?: {
  count?: number
  message?: string
  [key: string]: any
}): ApiSuccessResponse<T> {
  return {
    ok: true,
    data,
    ...options,
  }
}

type RetryStrategy = 'none' | 'immediate' | 'exponential_backoff' | 'after_retry_after'

function getRetryStrategy(
  statusCode: number,
  retryAfterSeconds?: number
): { retryable: boolean; retry_strategy: RetryStrategy } {
  if (statusCode >= 500) {
    return { retryable: true, retry_strategy: 'exponential_backoff' }
  }
  if (statusCode === 429 && retryAfterSeconds !== undefined) {
    return { retryable: true, retry_strategy: 'after_retry_after' }
  }
  return { retryable: false, retry_strategy: 'none' }
}

/**
 * Create a standardized error response with enhanced fields.
 * Returns both the response object and errorId for header setting.
 */
export function createErrorResponse(
  message: string,
  code: string,
  options?: {
    requestId?: string
    statusCode?: number
    details?: any
    error_hint?: string
    retry_after_seconds?: number
    [key: string]: any
  }
): { response: ApiErrorResponse; errorId: string } {
  const statusCode = options?.statusCode ?? 400
  const errorId = randomUUID()
  const registryEntry = ERROR_CODE_REGISTRY[code]

  const { retryable, retry_strategy } = getRetryStrategy(
    statusCode,
    options?.retry_after_seconds
  )

  const severity: 'error' | 'warn' | 'info' =
    statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'

  const error_hint =
    options?.error_hint ??
    registryEntry?.hint ??
    null

  const category = registryEntry?.category ?? ERROR_CATEGORIES.INTERNAL

  const classification =
    registryEntry?.classification ??
    (statusCode >= 500 ? ERROR_CLASSIFICATIONS.SYSTEM_TRANSIENT : ERROR_CLASSIFICATIONS.DEVELOPER_BUG)

  const support_url = registryEntry?.supportUrl

  const response: ApiErrorResponse = {
    ok: false,
    message,
    code,
    requestId: options?.requestId,
    request_id: options?.requestId,
    details: options?.details,
    error_id: errorId,
    severity,
    category,
    classification,
    retryable,
    retry_strategy,
    error_hint,
    ...(support_url && { support_url }),
    ...(options?.retry_after_seconds !== undefined && {
      retry_after_seconds: options.retry_after_seconds,
    }),
    ...(options
      ? Object.fromEntries(
          Object.entries(options).filter(
            ([k]) =>
              ![
                'requestId',
                'statusCode',
                'details',
                'error_hint',
                'retry_after_seconds',
              ].includes(k)
          )
        )
      : {}),
  }

  return { response, errorId }
}

/**
 * Export response schema for mutations (assign, resolve, etc.)
 */
export interface MutationResponse {
  ok: true
  message: string
  affected_count?: number
  ledger_entry_id?: string
  ledger_entry_ids?: string[]
  [key: string]: any
}

export interface ExportResponse {
  ok: true
  data: any[]
  count: number
  meta: {
    exportedAt: string
    format: 'csv' | 'json' | 'pdf'
    view?: string
    filters?: {
      time_range?: string
      category?: string
      site_id?: string
      job_id?: string
      actor_id?: string
      severity?: string
      outcome?: string
      start_date?: string
      end_date?: string
      [key: string]: any
    }
    requestId?: string
  }
  [key: string]: any
}

