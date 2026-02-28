/**
 * HMAC signing for webhook payloads.
 * Signatures are computed over a canonical timestamp-bound message (timestamp + separator + payload)
 * so that replay and header tampering are detectable. Headers: X-RiskMate-Signature: sha256={hash},
 * X-RiskMate-Timestamp: {unix}.
 *
 * Canonical source: lib/utils/webhookSigning.ts. Keep in sync with that file (CI checks identity).
 */
/**
 * Generate a 32-byte hex secret for webhook signing.
 */
export declare function generateSecret(): string;
/**
 * Build the canonical message used for signing/verification: timestamp + separator + payload.
 * Ensures signature integrity over both timestamp and body.
 */
export declare function buildTimestampBoundMessage(timestamp: string, payload: string): string;
/**
 * Sign a payload with HMAC-SHA256 using the given secret (payload only; prefer signPayloadWithTimestamp for webhooks).
 * Returns the hex digest (without "sha256=" prefix; add when setting header).
 */
export declare function signPayload(payload: string, secret: string): string;
/**
 * Sign the canonical timestamp-bound message (timestamp + separator + payload) with HMAC-SHA256.
 * Use this for webhook delivery so verification can enforce timestamp integrity and reject replays.
 */
export declare function signPayloadWithTimestamp(timestamp: string, payload: string, secret: string): string;
/**
 * Verify that signature matches HMAC-SHA256(payload, secret).
 * signature can be with or without "sha256=" prefix.
 * Prefer verifySignatureWithTimestamp for webhook requests to enforce timestamp and anti-replay.
 */
export declare function verifySignature(payload: string, signature: string, secret: string): boolean;
/** Default tolerance in seconds for timestamp validation (reject stale/future outside this window). */
export declare const DEFAULT_TIMESTAMP_WINDOW_SECONDS = 300;
export interface VerifySignatureWithTimestampOptions {
    /** Max allowed age of timestamp in seconds (default 300). Reject if older or too far in future. */
    windowSeconds?: number;
}
/**
 * Verify webhook signature computed over the canonical timestamp-bound message (timestamp + separator + payload).
 * Rejects if timestamp is missing, invalid, or outside the allowed window (anti-replay).
 */
export declare function verifySignatureWithTimestamp(payload: string, signature: string, secret: string, timestamp: string, options?: VerifySignatureWithTimestampOptions): boolean;
/**
 * Build headers for a webhook request: X-RiskMate-Signature (over timestamp+payload) and X-RiskMate-Timestamp.
 * Signature is computed over the canonical timestamp-bound message so consumers can verify and reject replays.
 */
export declare function buildSignatureHeaders(payload: string, secret: string): Record<string, string>;
//# sourceMappingURL=webhookSigning.d.ts.map