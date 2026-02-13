import crypto from 'crypto'

/**
 * Generate HMAC authentication token for PDF service.
 * Token is bound to the requested URL so it cannot be replayed for a different URL.
 * Format: timestamp:hmac_hex with message = requestId:url:timestamp
 */
export function generatePdfServiceAuthToken(secret: string, requestId: string, url: string): string {
  const timestamp = Date.now().toString()
  const message = `${requestId}:${url}:${timestamp}`
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return `${timestamp}:${hmac}`
}

