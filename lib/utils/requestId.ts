import { randomUUID } from 'crypto'
import { isValidUUID } from '@/lib/utils/uuid'

/**
 * Generate a unique request ID in UUID v4 format.
 * Public API v1 contract documents request_id as UUID for client parsers and log correlation.
 */
export function generateRequestId(): string {
  return randomUUID()
}

/**
 * Get request ID from headers or generate a new one.
 * Returns UUID format: uses x-request-id only if it is a valid UUID, otherwise generates UUID v4.
 */
export function getRequestId(request?: Request | { headers?: Headers | { get: (key: string) => string | null } }): string {
  if (!request) {
    return generateRequestId()
  }

  const headers = request.headers || (request as any).headers
  if (headers && typeof headers.get === 'function') {
    const headerId = headers.get('x-request-id') || headers.get('X-Request-Id')
    if (headerId && isValidUUID(headerId)) {
      return headerId
    }
  }

  return generateRequestId()
}

