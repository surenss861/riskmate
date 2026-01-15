/**
 * Structured Logging
 * 
 * Consistent log format with org_id, user_id, job_id, export_id, evidence_id, ledger_seq, request_id
 * Makes debugging and support tickets trivial
 */

interface StructuredLogContext {
  org_id?: string
  user_id?: string
  job_id?: string
  export_id?: string
  evidence_id?: string
  ledger_seq?: number
  request_id?: string
  [key: string]: any
}

/**
 * Structured log helper
 */
export function logStructured(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: StructuredLogContext = {}
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }

  // Use console methods (can be replaced with proper logging library)
  switch (level) {
    case 'error':
      console.error(JSON.stringify(logEntry))
      break
    case 'warn':
      console.warn(JSON.stringify(logEntry))
      break
    case 'debug':
      if (process.env.NODE_ENV !== 'production') {
        console.debug(JSON.stringify(logEntry))
      }
      break
    default:
      console.log(JSON.stringify(logEntry))
  }
}

/**
 * Log with request context
 */
export function logWithRequest(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  requestId: string | undefined,
  context: Omit<StructuredLogContext, 'request_id'> = {}
) {
  logStructured(level, message, {
    ...context,
    request_id: requestId,
  })
}
