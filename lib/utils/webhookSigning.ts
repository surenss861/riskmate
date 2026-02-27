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

const SHA256_HEX_LENGTH = 64

/**
 * Verify that signature matches HMAC-SHA256(payload, secret).
 * signature can be with or without "sha256=" prefix.
 * Returns false for malformed input to avoid timingSafeEqual throwing (e.g. mismatched buffer lengths).
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !payload || !secret) return false
  const expected = signPayload(payload, secret)
  const received = signature.startsWith(SIGNATURE_PREFIX)
    ? signature.slice(SIGNATURE_PREFIX.length).trim()
    : signature.trim()
  if (expected.length !== SHA256_HEX_LENGTH || received.length !== SHA256_HEX_LENGTH) return false
  if (!/^[0-9a-fA-F]+$/.test(received)) return false
  try {
    const expectedBuf = Buffer.from(expected, 'hex')
    const receivedBuf = Buffer.from(received, 'hex')
    if (expectedBuf.length !== receivedBuf.length) return false
    return crypto.timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
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
