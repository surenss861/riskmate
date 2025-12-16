# API Error Contract

This document defines the error response format for the RiskMate API. All error responses follow this contract to ensure consistent client handling and support correlation.

## Standard Error Response Format

All error responses include:

```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "request_id": "uuid-v4",
  // ... additional fields based on error type
}
```

### Common Fields

- **`message`** (string, required): Human-readable error description
- **`code`** (string, required): Machine-readable error code (uppercase, underscore-separated)
- **`request_id`** (string, required): Unique request identifier for correlation
- **`documentation_url`** (string, optional): Link to relevant documentation
- **`retry_after_seconds`** (number, optional): Seconds to wait before retrying (for rate-limited operations)

## Error Codes

### `CURSOR_NOT_SUPPORTED_FOR_SORT`

**Status:** `400 Bad Request`

**When:** Client attempts to use cursor pagination with a sort mode that doesn't support it.

**Response:**
```json
{
  "message": "Cursor pagination is not supported for status sorting. Use offset pagination (page parameter) instead.",
  "code": "CURSOR_NOT_SUPPORTED_FOR_SORT",
  "sort": "status_asc",
  "reason": "Status sorting uses in-memory ordering which is incompatible with cursor pagination",
  "documentation_url": "/docs/pagination#status-sorting",
  "allowed_pagination_modes": ["offset"],
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "retry_after_seconds": 3600
}
```

**Fields:**
- `sort` (string): The sort mode that was attempted
- `reason` (string): Explanation of why cursor pagination is not supported
- `documentation_url` (string): Link to pagination documentation
- `allowed_pagination_modes` (string[]): List of pagination modes that are supported for this sort
- `retry_after_seconds` (number, optional): Only present if rate-limited logging was triggered

**Client Handling:**
1. Check `allowed_pagination_modes` to determine fallback strategy
2. Retry with offset pagination (`page` parameter) instead of `cursor`
3. Log `request_id` for support correlation if issue persists

**Example Auto-Fallback:**
```typescript
try {
  const result = await jobsApi.list({ sort: 'status_asc', cursor: '...' });
} catch (error) {
  if (error.code === 'CURSOR_NOT_SUPPORTED_FOR_SORT') {
    // Auto-fallback to offset pagination
    const result = await jobsApi.list({ 
      sort: 'status_asc', 
      page: 1  // Use offset instead
    });
  }
}
```

## Pagination Modes

### Cursor Pagination

**Supported Sort Modes:**
- `created_desc` / `created_asc`
- `risk_desc` / `risk_asc`

**Cursor Format:**
- `created_*`: `{created_at}|{id}`
- `risk_*`: `{risk_score}|{created_at}|{id}`

**Usage:**
```http
GET /api/jobs?sort=created_desc&cursor=2025-01-16T10:30:00Z|uuid&limit=20
```

### Offset Pagination

**Supported Sort Modes:**
- All sort modes (including `status_asc` / `status_desc`)

**Usage:**
```http
GET /api/jobs?sort=status_asc&page=1&limit=20
```

## Request ID

Every API response (success or error) includes a `request_id` field. This enables:

- **Support Correlation:** Link client errors to server logs
- **Audit Trail:** Track requests across distributed systems
- **Debugging:** Correlate frontend errors with backend logs

**Header:**
```http
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

**Response Body:**
```json
{
  "data": [...],
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Clients can include their own request ID via the `X-Request-ID` header, which will be used if provided.

## Rate Limiting

Some operations use rate-limited logging (not request rate limiting). When rate-limited logging is active, the error response includes:

```json
{
  "retry_after_seconds": 3600
}
```

This indicates when the next log entry will be written (not when the request can be retried). Requests are not rate-limited, only logging is.

## Client Best Practices

1. **Always check `code` field** for programmatic error handling
2. **Use `request_id`** in support tickets and error logs
3. **Follow `allowed_pagination_modes`** for auto-fallback logic
4. **Read `documentation_url`** for detailed guidance
5. **Respect `retry_after_seconds`** for rate-limited operations

## Support

When reporting errors, always include:
- `request_id` from the error response
- `code` field
- Request parameters (sanitized)
- Client version/environment

---

**Last Updated:** 2025-01-16  
**Version:** 1.0.0

