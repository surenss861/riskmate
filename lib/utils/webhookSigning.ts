/**
 * HMAC signing for webhook payloads.
 * Signatures are computed over a canonical timestamp-bound message (timestamp + separator + payload)
 * so that replay and header tampering are detectable. Headers: X-RiskMate-Signature: sha256={hash},
 * X-RiskMate-Timestamp: {unix}.
 *
 * Canonical source: this file. Keep in sync with apps/backend/src/utils/webhookSigning.ts (CI checks identity).
 */

import crypto from 'crypto'

const ALGORITHM = 'sha256'
const SIGNATURE_PREFIX = 'sha256='
/** Separator for canonical message: timestamp + SEPARATOR + payload. */
const TIMESTAMP_PAYLOAD_SEPARATOR = '.'

/**
 * Generate a 32-byte hex secret for webhook signing.
 */
export function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Build the canonical message used for signing/verification: timestamp + separator + payload.
 * Ensures signature integrity over both timestamp and body.
 */
export function buildTimestampBoundMessage(timestamp: string, payload: string): string {
  return timestamp + TIMESTAMP_PAYLOAD_SEPARATOR + payload
}

/**
 * Sign a payload with HMAC-SHA256 using the given secret (payload only; prefer signPayloadWithTimestamp for webhooks).
 * Returns the hex digest (without "sha256=" prefix; add when setting header).
 */
export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac(ALGORITHM, secret).update(payload, 'utf8').digest('hex')
}

/**
 * Sign the canonical timestamp-bound message (timestamp + separator + payload) with HMAC-SHA256.
 * Use this for webhook delivery so verification can enforce timestamp integrity and reject replays.
 */
export function signPayloadWithTimestamp(
  timestamp: string,
  payload: string,
  secret: string
): string {
  const message = buildTimestampBoundMessage(timestamp, payload)
  return crypto.createHmac(ALGORITHM, secret).update(message, 'utf8').digest('hex')
}

const SHA256_HEX_LENGTH = 64

function parseAndCompareSignature(
  expected: string,
  receivedRaw: string
): boolean {
  const received = receivedRaw.startsWith(SIGNATURE_PREFIX)
    ? receivedRaw.slice(SIGNATURE_PREFIX.length).trim()
    : receivedRaw.trim()
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
 * Verify that signature matches HMAC-SHA256(payload, secret).
 * signature can be with or without "sha256=" prefix.
 * Prefer verifySignatureWithTimestamp for webhook requests to enforce timestamp and anti-replay.
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !payload || !secret) return false
  const expected = signPayload(payload, secret)
  return parseAndCompareSignature(expected, signature)
}

/** Default tolerance in seconds for timestamp validation (reject stale/future outside this window). */
export const DEFAULT_TIMESTAMP_WINDOW_SECONDS = 300 // 5 minutes

export interface VerifySignatureWithTimestampOptions {
  /** Max allowed age of timestamp in seconds (default 300). Reject if older or too far in future. */
  windowSeconds?: number
}

/**
 * Verify webhook signature computed over the canonical timestamp-bound message (timestamp + separator + payload).
 * Rejects if timestamp is missing, invalid, or outside the allowed window (anti-replay).
 */
export function verifySignatureWithTimestamp(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string,
  options?: VerifySignatureWithTimestampOptions
): boolean {
  if (!signature || !payload || !secret || !timestamp) return false
  const ts = timestamp.trim()
  const unix = parseInt(ts, 10)
  if (Number.isNaN(unix) || unix <= 0) return false
  const windowSeconds = options?.windowSeconds ?? DEFAULT_TIMESTAMP_WINDOW_SECONDS
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - unix) > windowSeconds) return false
  const expected = signPayloadWithTimestamp(ts, payload, secret)
  return parseAndCompareSignature(expected, signature)
}

/**
 * Build headers for a webhook request: X-RiskMate-Signature (over timestamp+payload) and X-RiskMate-Timestamp.
 * Signature is computed over the canonical timestamp-bound message so consumers can verify and reject replays.
 */
export function buildSignatureHeaders(payload: string, secret: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signPayloadWithTimestamp(timestamp, payload, secret)
  return {
    'Content-Type': 'application/json',
    'X-RiskMate-Signature': `${SIGNATURE_PREFIX}${signature}`,
    'X-RiskMate-Timestamp': timestamp,
  }
}
