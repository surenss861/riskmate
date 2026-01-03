import crypto from 'crypto'

/**
 * Generate HMAC authentication token for PDF service
 * Format: timestamp:hmac_hex
 */
export function generatePdfServiceAuthToken(secret: string, requestId: string): string {
  const timestamp = Date.now().toString()
  const message = `${requestId}:${timestamp}`
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return `${timestamp}:${hmac}`
}

