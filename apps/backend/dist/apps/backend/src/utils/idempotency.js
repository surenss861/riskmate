"use strict";
/**
 * Idempotency Utilities
 *
 * Prevents duplicate processing of requests using idempotency keys.
 * Keys are scoped by (organization_id, actor_id, endpoint) for isolation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIdempotency = checkIdempotency;
exports.storeIdempotencyKey = storeIdempotencyKey;
exports.hashPayload = hashPayload;
exports.getIdempotencyKey = getIdempotencyKey;
const IDEMPOTENCY_KEY_TTL_HOURS = 24;
/**
 * Check if an idempotency key has been used before
 * Returns the cached response if found, null otherwise
 */
async function checkIdempotency(supabase, idempotencyKey, organizationId, actorId, endpoint) {
    const { data, error } = await supabase
        .from('idempotency_keys')
        .select('response_status, response_body, response_headers, expires_at')
        .eq('idempotency_key', idempotencyKey)
        .eq('organization_id', organizationId)
        .eq('actor_id', actorId)
        .eq('endpoint', endpoint)
        .gt('expires_at', new Date().toISOString()) // Only non-expired keys
        .maybeSingle();
    if (error) {
        console.error('Idempotency check error:', error);
        // On error, proceed (fail open) - don't block requests due to idempotency table issues
        return null;
    }
    if (data) {
        return {
            isDuplicate: true,
            response: {
                status: data.response_status,
                body: data.response_body,
                headers: data.response_headers,
            },
        };
    }
    return { isDuplicate: false };
}
/**
 * Store an idempotency key with response for future duplicate detection
 * Optionally stores payload hash for validation (Option B: stronger compliance)
 */
async function storeIdempotencyKey(supabase, idempotencyKey, organizationId, actorId, endpoint, responseStatus, responseBody, responseHeaders, payloadHash // Optional: hash of request payload for validation
) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_KEY_TTL_HOURS);
    const insertData = {
        idempotency_key: idempotencyKey,
        organization_id: organizationId,
        actor_id: actorId,
        endpoint,
        response_status: responseStatus,
        response_body: responseBody,
        response_headers: responseHeaders || {},
        expires_at: expiresAt.toISOString(),
    };
    // Option B: Store payload hash if provided (for stronger validation)
    if (payloadHash) {
        insertData.metadata = { payload_hash: payloadHash };
    }
    const { error } = await supabase
        .from('idempotency_keys')
        .insert(insertData);
    if (error) {
        // Log but don't throw - idempotency storage failure shouldn't break requests
        // The unique constraint will prevent duplicates even if this insert fails
        console.error('Failed to store idempotency key:', error);
    }
}
/**
 * Compute hash of request payload for validation (Option B)
 */
function hashPayload(payload) {
    const crypto = require('crypto');
    const payloadStr = JSON.stringify(payload, Object.keys(payload || {}).sort());
    return crypto.createHash('sha256').update(payloadStr).digest('hex');
}
/**
 * Middleware helper: Extract idempotency key from request headers
 */
function getIdempotencyKey(req) {
    const key = req.headers['idempotency-key'] || req.headers['Idempotency-Key'];
    return typeof key === 'string' ? key : undefined;
}
//# sourceMappingURL=idempotency.js.map