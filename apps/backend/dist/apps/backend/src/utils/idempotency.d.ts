/**
 * Idempotency Utilities
 *
 * Prevents duplicate processing of requests using idempotency keys.
 * Keys are scoped by (organization_id, actor_id, endpoint) for isolation.
 */
import { SupabaseClient } from '@supabase/supabase-js';
export interface IdempotencyResult<T = any> {
    isDuplicate: boolean;
    response?: {
        status: number;
        body: T;
        headers?: Record<string, string>;
    };
    cachedPayloadHash?: string;
}
/**
 * Check if an idempotency key has been used before
 * Returns the cached response if found, null otherwise
 */
export declare function checkIdempotency<T = any>(supabase: SupabaseClient, idempotencyKey: string, organizationId: string, actorId: string, endpoint: string): Promise<IdempotencyResult<T> | null>;
/**
 * Store an idempotency key with response for future duplicate detection
 * Optionally stores payload hash for validation (Option B: stronger compliance)
 */
export declare function storeIdempotencyKey(supabase: SupabaseClient, idempotencyKey: string, organizationId: string, actorId: string, endpoint: string, responseStatus: number, responseBody: any, responseHeaders?: Record<string, string>, payloadHash?: string): Promise<void>;
/**
 * Compute hash of request payload for validation (Option B)
 */
export declare function hashPayload(payload: any): string;
/**
 * Middleware helper: Extract idempotency key from request headers
 */
export declare function getIdempotencyKey(req: {
    headers: Record<string, string | string[] | undefined>;
}): string | undefined;
//# sourceMappingURL=idempotency.d.ts.map