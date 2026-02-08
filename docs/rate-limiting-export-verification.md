# Export Routes Rate Limiting — Implementation & Verification

## Observation

The rate limiting implementation for export routes has **already been completed**. All three export routes (`app/api/audit/export/route.ts`, `app/api/proof-packs/export/route.ts`, `app/api/incidents/export/route.ts`) have been updated with rate limiting functionality. The rate limiter utility (`lib/utils/rateLimiter.ts`) exists and provides the required `checkRateLimitWithContext` function and `RATE_LIMIT_CONFIGS.export` configuration. Each route properly handles rate limit checks, returns 429 responses with retry headers when limits are exceeded, includes rate limit headers in all responses, and logs rate limit events.

## Approach

Since the implementation is already complete, this document records the existing implementation for verification purposes. The approach follows the spec requirements exactly: rate limiting is applied after authentication, uses the export configuration (10 requests per hour per organization), returns standardized 429 responses with retry guidance, includes rate limit headers in all responses (both success and error), and logs rate limit events in structured JSON format for monitoring.

## Implementation Status

### ✅ Rate Limiter Utility — COMPLETED

The utility at `lib/utils/rateLimiter.ts` provides:

- `checkRateLimitWithContext()` function for checking rate limits with explicit context
- `RATE_LIMIT_CONFIGS.export` configuration (10 requests per hour)
- In-memory store with automatic cleanup
- Proper return types with `allowed`, `limit`, `remaining`, `resetAt`, and `retryAfter` fields

### ✅ Audit Export Route — COMPLETED

**File**: `app/api/audit/export/route.ts`

**Implementation Details**:

- **Line 8**: Imports `checkRateLimitWithContext` and `RATE_LIMIT_CONFIGS`
- **Lines 53–56**: Calls rate limit check after authentication with `RATE_LIMIT_CONFIGS.export`
- **Lines 57–98**: Handles rate limit exceeded case:
  - Logs structured JSON event (lines 58–67)
  - Creates error response with `RATE_LIMIT_EXCEEDED` code (lines 68–81)
  - Logs API error (lines 82–86)
  - Returns 429 response with headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (lines 87–97)
- **Lines 330–333**: Includes rate limit headers in success response

### ✅ Proof Packs Export Route — COMPLETED

**File**: `app/api/proof-packs/export/route.ts`

**Implementation Details**:

- **Line 8**: Imports `checkRateLimitWithContext` and `RATE_LIMIT_CONFIGS`
- **Lines 50–53**: Calls rate limit check after authentication with `RATE_LIMIT_CONFIGS.export`
- **Lines 54–95**: Handles rate limit exceeded case with same pattern as audit route
- **Lines 231–233** (CSV response): Includes rate limit headers
- **Lines 262–264** (JSON response): Includes rate limit headers

### ✅ Incidents Export Route — COMPLETED

**File**: `app/api/incidents/export/route.ts`

**Implementation Details**:

- **Line 8**: Imports `checkRateLimitWithContext` and `RATE_LIMIT_CONFIGS`
- **Lines 50–53**: Calls rate limit check after authentication with `RATE_LIMIT_CONFIGS.export`
- **Lines 54–95**: Handles rate limit exceeded case with same pattern as other routes
- **Lines 186–188** (CSV response): Includes rate limit headers
- **Lines 217–219** (JSON response): Includes rate limit headers

## Verification Checklist

To verify the implementation is working correctly:

1. **Rate Limit Enforcement**
   - Make 10 export requests within 1 hour → all should succeed with rate limit headers
   - Make 11th request → should return 429 with `Retry-After` header
   - Wait for window reset → request should succeed again

2. **Response Headers**
   - All success responses include: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
   - 429 responses include: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-Request-ID`, `X-Error-ID`

3. **Logging**
   - Rate limit exceeded events are logged in structured JSON format
   - Logs include: `event`, `organization_id`, `user_id`, `endpoint`, `limit`, `window_ms`, `retry_after`, `request_id`

4. **Error Response Format**
   - 429 responses follow standard error format with `RATE_LIMIT_EXCEEDED` code
   - Include `retry_after_seconds` and `details` with limit, window, and resetAt

5. **Functionality Preservation**
   - All existing export functionality works correctly within rate limits
   - No breaking changes to API contracts
