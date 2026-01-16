/**
 * Idempotency-Aware Fetch Wrapper
 * 
 * Ensures all resolve actions include Idempotency-Key header and handle replay responses correctly.
 * This prevents duplicate processing from double-clicks, retries, and flaky networks.
 */

export type IdempotencyMeta = {
  requestId?: string;
  replayed?: boolean;
  idempotencyKey: string;
};

export interface IdempotencyError extends Error {
  code?: string;
  requestId?: string;
  details?: any;
  status?: number;
}

/**
 * Fetch with automatic idempotency key generation and replay detection
 * 
 * @param input - Request URL or Request object
 * @param init - Fetch options with optional idempotencyKey
 * @returns Promise with JSON response and metadata (requestId, replayed, idempotencyKey)
 * 
 * @example
 * ```ts
 * const { json, meta } = await fetchWithIdempotency('/api/audit/readiness/resolve', {
 *   method: 'POST',
 *   body: JSON.stringify({ readiness_item_id, rule_code, action_type, payload }),
 * });
 * 
 * if (meta.replayed) {
 *   console.log('Response was replayed from cache');
 * }
 * ```
 */
export async function fetchWithIdempotency<T = any>(
  input: RequestInfo | URL,
  init: RequestInit & { idempotencyKey?: string } = {}
): Promise<{ json: T; meta: IdempotencyMeta }> {
  // Generate idempotency key if not provided
  const idempotencyKey = init.idempotencyKey ?? crypto.randomUUID();

  // Get auth token (use same pattern as api.ts)
  let token: string | undefined;
  if (typeof window !== 'undefined') {
    try {
      const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[Idempotency] Session error:', sessionError);
      } else if (!session) {
        console.warn('[Idempotency] No active session');
      } else {
        token = session.access_token || undefined;
        // Verify token is not anon token
        if (token && token.length < 100) {
          console.warn('[Idempotency] Token appears invalid (too short)');
          token = undefined;
        }
      }
    } catch (error) {
      console.error('[Idempotency] Failed to get auth token:', error);
    }
  }

  // Prepare headers
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Idempotency-Key', idempotencyKey);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Make request (input can be string, URL, or Request object - fetch handles it)
  const res = await fetch(input, {
    ...init,
    headers,
  });

  // Extract response metadata
  const requestId = res.headers.get('X-Request-ID') ?? undefined;
  const replayed = (res.headers.get('X-Idempotency-Replayed') ?? 'false') === 'true';

  // Parse JSON response
  const json = await res.json().catch(() => null);

  // Handle errors
  if (!res.ok) {
    // Backend returns standardized errors - throw them cleanly
    const err = new Error(json?.message || `Request failed with status ${res.status}`) as IdempotencyError;
    err.code = json?.code;
    err.requestId = json?.requestId || requestId;
    err.details = json?.details || json?.error;
    err.status = res.status;
    
    // Include error ID from headers if available
    const errorId = res.headers.get('X-Error-ID');
    if (errorId) {
      (err as any).errorId = errorId;
    }
    
    throw err;
  }

  return {
    json: json as T,
    meta: {
      requestId,
      replayed,
      idempotencyKey,
    },
  };
}

/**
 * Generate idempotency key for bulk operations
 * Creates a unique key per item: `${baseKey}-${itemId}`
 * 
 * @param baseKey - Base UUID (usually generated once for the bulk operation)
 * @param itemId - Unique identifier for the item (e.g., readiness_item_id)
 * @returns Composite idempotency key
 * 
 * @example
 * ```ts
 * const baseKey = crypto.randomUUID();
 * const itemKey = generateBulkIdempotencyKey(baseKey, item.readiness_item_id);
 * ```
 */
export function generateBulkIdempotencyKey(baseKey: string, itemId: string): string {
  return `${baseKey}-${itemId}`;
}

/**
 * Helper to extract request ID for debugging/logging
 * Use this in toasts, modals, and dev tools
 */
export function formatRequestId(requestId?: string): string {
  return requestId ? `Request ID: ${requestId}` : '';
}

