/**
 * AES-256-GCM decryption for webhook secrets at rest.
 * Use WEBHOOK_SECRET_ENCRYPTION_KEY (32-byte hex = 64 chars) in env.
 * Format: "v1:" + base64(iv || ciphertext || authTag); iv=12 bytes, authTag=16 bytes.
 */
/**
 * Decrypt a stored value. If it starts with "v1:" and key is set, decrypt; otherwise return as-is (plaintext).
 */
export declare function decryptWebhookSecret(ciphertext: string, keyHex: string | undefined): string;
//# sourceMappingURL=secretEncryption.d.ts.map