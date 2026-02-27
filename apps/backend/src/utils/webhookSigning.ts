/**
 * HMAC signing for webhook payloads (backend copy; mirrors lib/utils/webhookSigning.ts).
 * Headers: X-RiskMate-Signature: sha256={hash}, X-RiskMate-Timestamp: {unix}
 */

import crypto from 'crypto'

const ALGORITHM = 'sha256'
const SIGNATURE_PREFIX = 'sha256='

export function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac(ALGORITHM, secret).update(payload, 'utf8').digest('hex')
}

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
  if (expected.length !== received.length || expected.length !== 64) return false
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))
}

export function buildSignatureHeaders(payload: string, secret: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signPayload(payload, secret)
  return {
    'Content-Type': 'application/json',
    'X-RiskMate-Signature': `${SIGNATURE_PREFIX}${signature}`,
    'X-RiskMate-Timestamp': timestamp,
  }
}
