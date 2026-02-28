/**
 * AES-256-GCM encryption for webhook secrets at rest.
 * Use WEBHOOK_SECRET_ENCRYPTION_KEY (32-byte hex = 64 chars) in env.
 * Format: "v1:" + base64(iv || ciphertext || authTag); iv=12 bytes, authTag=16 bytes.
 */

import crypto from 'crypto'

const PREFIX = 'v1:'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH_BYTES = 32
const KEY_HEX_LENGTH = KEY_LENGTH_BYTES * 2

/**
 * Validate WEBHOOK_SECRET_ENCRYPTION_KEY format (64 hex characters).
 * Use at startup or runtime to ensure web and backend use compatible configuration.
 */
export function validateWebhookSecretEncryptionKey(
  keyHex: string | undefined
): { valid: true } | { valid: false; message: string } {
  if (keyHex === undefined || keyHex === null) {
    return { valid: false, message: 'WEBHOOK_SECRET_ENCRYPTION_KEY is not set' }
  }
  if (typeof keyHex !== 'string') {
    return { valid: false, message: 'WEBHOOK_SECRET_ENCRYPTION_KEY must be a string' }
  }
  const trimmed = keyHex.trim()
  if (!trimmed) {
    return { valid: false, message: 'WEBHOOK_SECRET_ENCRYPTION_KEY is empty' }
  }
  if (trimmed.length !== KEY_HEX_LENGTH) {
    return { valid: false, message: `WEBHOOK_SECRET_ENCRYPTION_KEY must be ${KEY_HEX_LENGTH} hex characters (32 bytes)` }
  }
  if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    return { valid: false, message: 'WEBHOOK_SECRET_ENCRYPTION_KEY must be hexadecimal only' }
  }
  return { valid: true }
}

function keyFromHex(hex: string): Buffer {
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== KEY_LENGTH_BYTES) {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY must be 32 bytes (64 hex characters)')
  }
  return buf
}

export const WEBHOOK_SECRET_ENCRYPTION_KEY_ERROR =
  'WEBHOOK_SECRET_ENCRYPTION_KEY must be set and be 32 bytes (64 hex characters) for webhook secret encryption'

/**
 * Encrypt a plaintext webhook secret for storage.
 * Returns "v1:" + base64(iv || ciphertext || authTag).
 * Throws when key is missing or invalid (fail-closed: do not store plaintext).
 */
export function encryptWebhookSecret(plaintext: string, keyHex: string | undefined): string {
  if (!keyHex || typeof keyHex !== 'string') {
    throw new Error(WEBHOOK_SECRET_ENCRYPTION_KEY_ERROR)
  }
  const trimmed = keyHex.trim()
  if (!trimmed) {
    throw new Error(WEBHOOK_SECRET_ENCRYPTION_KEY_ERROR)
  }
  const key = keyFromHex(trimmed)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const combined = Buffer.concat([iv, enc, tag])
  return PREFIX + combined.toString('base64')
}

/**
 * Decrypt a stored value. If it starts with "v1:", key is required and decryption must succeed (fail-closed).
 * Plaintext secrets (no "v1:" prefix) are returned as-is; when key is missing and value is plaintext, a structured warning is logged so operators can detect unencrypted secrets in production.
 */
export function decryptWebhookSecret(ciphertext: string, keyHex: string | undefined): string {
  if (!ciphertext || typeof ciphertext !== 'string') return ''
  if (!ciphertext.startsWith(PREFIX)) {
    if (!keyHex || (typeof keyHex === 'string' && !keyHex.trim())) {
      console.warn('[WebhookSecret] WEBHOOK_SECRET_ENCRYPTION_KEY is unset; using plaintext secret (encryption at rest not active). Set the key and re-save endpoint secrets to encrypt.', { hasPlaintext: true })
    }
    return ciphertext
  }
  if (!keyHex || typeof keyHex !== 'string') {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY is required to decrypt webhook secrets but is missing')
  }
  const trimmed = keyHex.trim()
  if (!trimmed) {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY is required to decrypt webhook secrets but is empty')
  }
  const key = keyFromHex(trimmed)
  const raw = Buffer.from(ciphertext.slice(PREFIX.length), 'base64')
  if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Stored webhook secret is invalid (v1 format truncated or corrupted)')
  }
  const iv = raw.subarray(0, IV_LENGTH)
  const tag = raw.subarray(raw.length - AUTH_TAG_LENGTH)
  const enc = raw.subarray(IV_LENGTH, raw.length - AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final('utf8')
}
