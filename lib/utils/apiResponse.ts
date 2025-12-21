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
  details?: any
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

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  message: string,
  code: string,
  options?: {
    requestId?: string
    statusCode?: number
    details?: any
    [key: string]: any
  }
): ApiErrorResponse {
  return {
    ok: false,
    message,
    code,
    requestId: options?.requestId,
    details: options?.details,
    ...(options ? Object.fromEntries(Object.entries(options).filter(([k]) => !['requestId', 'statusCode', 'details'].includes(k))) : {}),
  }
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

