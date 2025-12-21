import { randomUUID } from 'crypto'

/**
 * Generate a unique request ID for tracking requests across logs
 * Format: timestamp-uuid for easier sorting and filtering
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const uuid = randomUUID().slice(0, 8)
  return `${timestamp}-${uuid}`
}

/**
 * Get request ID from headers or generate a new one
 */
export function getRequestId(request?: Request | { headers?: Headers | { get: (key: string) => string | null } }): string {
  if (!request) {
    return generateRequestId()
  }

  const headers = request.headers || (request as any).headers
  if (headers) {
    const headerId = typeof headers.get === 'function' 
      ? headers.get('x-request-id') || headers.get('X-Request-Id')
      : null
    
    if (headerId) {
      return headerId
    }
  }

  return generateRequestId()
}

