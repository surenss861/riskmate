/**
 * HMAC signing for webhook payloads.
 * Headers: X-RiskMate-Signature: sha256={hash}, X-RiskMate-Timestamp: {unix}
 */

import crypto from 'crypto'

const ALGORITHM = 'sha256'
const SIGNATURE_PREFIX = 'sha256='

/**
 * Generate a 32-byte hex secret for webhook signing.
 */
export function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Sign a payload with HMAC-SHA256 using the given secret.
 * Returns the hex digest (without "sha256=" prefix; add when setting header).
 */
export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac(ALGORITHM, secret).update(payload, 'utf8').digest('hex')
}

/**
 * Verify that signature matches HMAC-SHA256(payload, secret).
 * signature can be with or without "sha256=" prefix.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !payload || !secret) return false
  const expected = signPayload(payload, secret)
  const received = signature.startsWith(SIGNATURE_PREFIX)
    ? signature.slice(SIGNATURE_PREFIX.length)
    : signature
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))
}

/**
 * Build headers for a webhook request: X-RiskMate-Signature and X-RiskMate-Timestamp.
 */
export function buildSignatureHeaders(payload: string, secret: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signPayload(payload, secret)
  return {
    'Content-Type': 'application/json',
    'X-RiskMate-Signature': `${SIGNATURE_PREFIX}${signature}`,
    'X-RiskMate-Timestamp': timestamp,
  }
}
