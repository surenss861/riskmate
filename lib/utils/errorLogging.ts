/**
 * Structured logging for API errors.
 * Provides consistent JSON format for 4xx/5xx errors with error budget tracking.
 */

export function logApiError(
  statusCode: number,
  code: string,
  errorId: string,
  requestId: string | undefined,
  organizationId: string | undefined,
  message: string,
  options?: {
    category?: string
    severity?: 'error' | 'warn' | 'info'
    route?: string
    details?: any
  }
): void {
  if (statusCode < 400) return

  const { category, severity, route, details } = options ?? {}
  const errorSeverity = severity ?? (statusCode >= 500 ? 'error' : 'warn')

  const logEntry: Record<string, any> = {
    level: errorSeverity,
    status: statusCode,
    code,
    error_id: errorId,
    request_id: requestId ?? 'unknown',
    organization_id: organizationId ?? 'unknown',
    category: category ?? 'internal',
    message,
    timestamp: new Date().toISOString(),
  }

  if (route) {
    logEntry.route = route
  }

  if (statusCode >= 500) {
    logEntry.error_budget = {
      route: route ?? 'unknown',
      organization_id: organizationId ?? 'unknown',
      status: statusCode,
    }
  }

  if (process.env.NODE_ENV === 'development' && details !== undefined) {
    logEntry.details = details
  }

  console.error(JSON.stringify(logEntry))
}
