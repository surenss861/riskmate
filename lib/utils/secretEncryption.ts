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

function keyFromHex(hex: string): Buffer {
  const buf = Buffer.from(hex, 'hex')
  if (buf.length !== KEY_LENGTH_BYTES) {
    throw new Error('WEBHOOK_SECRET_ENCRYPTION_KEY must be 32 bytes (64 hex characters)')
  }
  return buf
}

/**
 * Encrypt a plaintext webhook secret for storage.
 * Returns "v1:" + base64(iv || ciphertext || authTag). If key is missing or invalid, returns null (store plaintext).
 */
export function encryptWebhookSecret(plaintext: string, keyHex: string | undefined): string | null {
  if (!keyHex || typeof keyHex !== 'string') return null
  const trimmed = keyHex.trim()
  if (!trimmed) return null
  try {
    const key = keyFromHex(trimmed)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH })
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const combined = Buffer.concat([iv, enc, tag])
    return PREFIX + combined.toString('base64')
  } catch {
    return null
  }
}

/**
 * Decrypt a stored value. If it starts with "v1:" and key is set, decrypt; otherwise return as-is (plaintext).
 */
export function decryptWebhookSecret(ciphertext: string, keyHex: string | undefined): string {
  if (!ciphertext || typeof ciphertext !== 'string') return ''
  if (!keyHex || typeof keyHex !== 'string') return ciphertext
  const trimmed = keyHex.trim()
  if (!trimmed || !ciphertext.startsWith(PREFIX)) return ciphertext
  try {
    const key = keyFromHex(trimmed)
    const raw = Buffer.from(ciphertext.slice(PREFIX.length), 'base64')
    if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) return ciphertext
    const iv = raw.subarray(0, IV_LENGTH)
    const tag = raw.subarray(raw.length - AUTH_TAG_LENGTH)
    const enc = raw.subarray(IV_LENGTH, raw.length - AUTH_TAG_LENGTH)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(tag)
    return decipher.update(enc) + decipher.final('utf8')
  } catch {
    return ciphertext
  }
}
