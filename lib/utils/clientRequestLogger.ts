/**
 * Client-side request logger for debugging
 * Logs failed requests with route, status, and requestId for easy correlation with backend logs
 */

export interface RequestLogEntry {
  route: string
  method: string
  status: number
  requestId?: string
  error?: {
    code?: string
    message?: string
  }
  timestamp: string
}

const MAX_LOG_ENTRIES = 50
const requestLog: RequestLogEntry[] = []

/**
 * Log a failed API request
 */
export function logFailedRequest(
  route: string,
  method: string,
  status: number,
  error?: { code?: string; message?: string; requestId?: string }
): void {
  if (typeof window === 'undefined') return

  const entry: RequestLogEntry = {
    route,
    method,
    status,
    requestId: error?.requestId,
    error: error ? { code: error.code, message: error.message } : undefined,
    timestamp: new Date().toISOString(),
  }

  requestLog.push(entry)

  // Keep only the most recent entries
  if (requestLog.length > MAX_LOG_ENTRIES) {
    requestLog.shift()
  }

  // Log to console with a formatted message for easy debugging
  console.error(
    `[API Error] ${method} ${route} → ${status}${error?.requestId ? ` (requestId: ${error.requestId})` : ''}`,
    error || 'Unknown error'
  )

  // In development, also log to window for easy access
  if (process.env.NODE_ENV === 'development') {
    ;(window as any).__apiRequestLog = requestLog
    console.log(
      '%c[Debug] Failed requests logged to window.__apiRequestLog',
      'color: #F97316; font-weight: bold'
    )
  }
}

/**
 * Get recent failed requests (useful for debugging)
 */
export function getRecentFailedRequests(): RequestLogEntry[] {
  return [...requestLog].reverse() // Most recent first
}

/**
 * Clear the request log
 */
export function clearRequestLog(): void {
  requestLog.length = 0
}

