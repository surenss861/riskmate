/**
 * SSRF-safe webhook URL validation: reject localhost, loopback, private,
 * link-local, CGNAT, multicast, and reserved ranges; enforce HTTPS outside local development.
 * Resolves DNS (A/AAAA) and rejects if any resolved address is non-public to prevent
 * DNS rebinding and hostnames that resolve to internal IPs.
 * IPv4-mapped IPv6 (including hex forms like ::ffff:7f00:1) are normalized and checked.
 *
 * Canonical source: lib/utils/webhookUrl.ts. Keep in sync with that file (CI checks identity).
 */
export type WebhookUrlResult = WebhookUrlValidationSuccess | {
    valid: false;
    reason: string;
    terminal: true;
} | {
    valid: false;
    reason: string;
    terminal: false;
};
/** When valid: true, contains resolution details so the caller can pin the outbound connection to the vetted IP (prevents DNS rebinding). */
export type WebhookUrlValidationSuccess = {
    valid: true;
    /** Original hostname (for Host header and TLS SNI / certificate verification). */
    hostname: string;
    /** Resolved IP to connect to; request must be sent to this address only. */
    resolvedAddress: string;
    port: number;
    protocol: 'http' | 'https';
    /** pathname + search for the request. */
    path: string;
    /** Value for the Host header (e.g. "example.com" or "example.com:8443"). */
    hostHeader: string;
};
/**
 * Returns whether the URL is allowed for webhook endpoints.
 * Resolves hostnames and rejects if any resolved IP is private/loopback/link-local/CGNAT/multicast.
 * When valid, returns resolution details so the caller can pin the outbound connection to the vetted IP.
 */
export declare function validateWebhookUrl(urlString: string): Promise<WebhookUrlResult>;
//# sourceMappingURL=webhookUrl.d.ts.map