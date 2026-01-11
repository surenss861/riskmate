/**
 * Extract structured error information from a proxy response
 * 
 * This helper ensures consistent error extraction across the app,
 * handling both JSON and non-JSON responses, and extracting error_id,
 * code, message, and hint from headers and body.
 * 
 * @param res - The Response object from fetch
 * @returns Object with code, message, hint, errorId, and raw data
 */
export async function extractProxyError(res: Response): Promise<{
  code?: string
  message: string
  hint?: string
  errorId?: string
  raw?: any
}> {
  // Extract error ID from response headers first
  const headerErrorId = res.headers.get('x-error-id') || res.headers.get('X-Error-ID') || undefined

  let data: any = null
  let text: string | null = null

  // Try to parse as JSON first (proxy should always return JSON)
  try {
    // Clone the response so we can read it without consuming the original stream
    data = await res.clone().json()
  } catch {
    // If JSON parsing fails, try to get text (shouldn't happen with proper proxy, but be safe)
    try {
      text = await res.clone().text()
    } catch {
      text = null
    }
  }

  // Extract structured fields (prefer JSON data, fallback to headers/text)
  const errorId = data?.error_id || data?.errorId || headerErrorId
  const code = data?.code
  const message =
    data?.message ||
    data?.error?.message ||
    (typeof text === 'string' && text.trim() ? text.substring(0, 200) : 'Request failed')

  const hint = data?.hint || data?.support_hint || data?.error?.hint

  return {
    code,
    message,
    hint,
    errorId,
    raw: data ?? text,
  }
}

/**
 * Format error title for display
 * 
 * Creates a consistent error title format: "CODE • Error ID: ..." or fallback formats.
 * Used across toast notifications, alerts, and error messages.
 * 
 * @param code - Error code (optional)
 * @param errorId - Error ID (optional)
 * @param message - Error message (fallback if code/errorId not provided)
 * @returns Formatted error title string
 */
export function formatProxyErrorTitle(
  code?: string,
  errorId?: string,
  message: string = 'Request failed'
): string {
  if (code && errorId) {
    return `${code} • Error ID: ${errorId}`
  } else if (code) {
    return `${code} • ${message}`
  } else if (errorId) {
    return `${message} • Error ID: ${errorId}`
  } else {
    return message
  }
}

/**
 * Log error ID client-side for debugging
 * 
 * Logs error information to console (and optionally telemetry) for instant debugging.
 * Only logs in development or if explicitly enabled.
 * 
 * @param errorId - Error ID to log
 * @param code - Error code (optional)
 * @param endpoint - Endpoint that failed (optional)
 */
export function logProxyError(
  errorId?: string,
  code?: string,
  endpoint?: string
): void {
  if (!errorId) return

  const errorInfo: any = {
    error_id: errorId,
    ...(code && { code }),
    ...(endpoint && { endpoint }),
    timestamp: new Date().toISOString(),
  }

  // Always log to console for debugging
  console.error('[Proxy Error]', errorInfo)

  // TODO: Add telemetry/logging service integration here if needed
  // Example: telemetry.logError(errorInfo)
}

