/**
 * AES-256-GCM decryption for webhook secrets at rest.
 * Use WEBHOOK_SECRET_ENCRYPTION_KEY (32-byte hex = 64 chars) in env.
 * Format: "v1:" + base64(iv || ciphertext || authTag); iv=12 bytes, authTag=16 bytes.
 */
/**
 * Validate WEBHOOK_SECRET_ENCRYPTION_KEY format (64 hex characters).
 * Use at startup to ensure backend and web use compatible configuration.
 */
export declare function validateWebhookSecretEncryptionKey(keyHex: string | undefined): {
    valid: true;
} | {
    valid: false;
    message: string;
};
export declare const WEBHOOK_SECRET_DECRYPTION_ERROR = "WEBHOOK_SECRET_ENCRYPTION_KEY is missing or invalid; ensure web and backend use the same key";
/**
 * Decrypt a stored value. If it starts with "v1:", key is required and decryption must succeed (fail-closed).
 * Plaintext secrets (no "v1:" prefix) are returned as-is; when key is missing and value is plaintext, a structured warning is logged so operators can detect unencrypted secrets in production.
 * Throws when an encrypted payload is present but key is missing/invalid or decryption fails.
 */
export declare function decryptWebhookSecret(ciphertext: string, keyHex: string | undefined): string;
//# sourceMappingURL=secretEncryption.d.ts.map