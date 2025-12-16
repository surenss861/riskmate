# API Error Contract

This document defines the error response format for the RiskMate API. All error responses follow this contract to ensure consistent client handling and support correlation.

## Standard Error Response Format

All error responses include:

```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "support_hint": "Short actionable guidance",
  // ... additional fields based on error type
}
```

### Common Fields

- **`message`** (string, required): Human-readable error description
- **`code`** (string, required): Machine-readable error code (uppercase, underscore-separated)
- **`error_id`** (string, required): Unique error instance identifier (for error aggregation/tracking)
- **`request_id`** (string, required): Unique request identifier for correlation (echoes `X-Request-ID` header if provided)
- **`support_hint`** (string, optional): Short, actionable guidance (documentation_url provides detailed help)
- **`documentation_url`** (string, optional): Link to relevant documentation
- **`retry_after_seconds`** (number, optional): Seconds to wait before retrying (for rate-limited operations)

## Error Codes

### `JOB_LIMIT_REACHED`

**Status:** `403 Forbidden`

**When:** Monthly job creation limit has been reached for the current plan.

**Response:**
```json
{
  "message": "Plan job limit reached. Upgrade your plan to create more jobs.",
  "code": "JOB_LIMIT_REACHED",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "support_hint": "Upgrade plan or wait for monthly limit reset",
  "limit": 10,
  "current_count": 10
}
```

**Client Handling:**
- Check `limit` and `current_count` to display upgrade prompt
- Wait for monthly reset or upgrade plan

---

### `PLAN_PAST_DUE`

**Status:** `402 Payment Required`

**When:** Subscription payment is past due.

**Response:**
```json
{
  "message": "Your subscription is not active. Update billing to create new jobs.",
  "code": "PLAN_PAST_DUE",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "support_hint": "Update payment method in billing settings",
  "subscription_status": "past_due"
}
```

**Client Handling:**
- Redirect to billing/payment settings
- Display payment update prompt

---

### `ROLE_FORBIDDEN`

**Status:** `403 Forbidden`

**When:** User lacks required role for the operation.

**Response:**
```json
{
  "message": "Only organization owners can delete jobs",
  "code": "ROLE_FORBIDDEN",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "support_hint": "This action requires owner role. Contact your organization owner",
  "required_role": "owner",
  "current_role": "admin"
}
```

**Client Handling:**
- Hide/disable action for insufficient roles
- Display role requirement message

---

### `CURSOR_NOT_SUPPORTED_FOR_SORT`

**Status:** `400 Bad Request`

**When:** Client attempts to use cursor pagination with a sort mode that doesn't support it.

**Response:**
```json
{
  "message": "Cursor pagination is not supported for status sorting. Use offset pagination (page parameter) instead.",
  "code": "CURSOR_NOT_SUPPORTED_FOR_SORT",
  "error_id": "660e8400-e29b-41d4-a716-446655440001",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "support_hint": "Remove cursor param or switch to page-based pagination",
  "sort": "status_asc",
  "reason": "Status sorting uses in-memory ordering which is incompatible with cursor pagination",
  "documentation_url": "/docs/pagination#status-sorting",
  "allowed_pagination_modes": ["offset"],
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

**Echo Behavior:** If a client sends `X-Request-ID` header, the server will reuse it. Otherwise, a new UUID is generated. This helps when upstream gateways already stamp IDs.

## Error ID

Every error response includes an `error_id` field separate from `request_id`:

- **`request_id`**: Ties to one HTTP request
- **`error_id`**: Ties to the error instance/classification (useful for error aggregation)

This enables tracking error patterns across multiple requests.

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

## Support Console

All 4xx/5xx errors are automatically logged with structured JSON:

```json
{
  "level": "warn",
  "status": 403,
  "code": "JOB_LIMIT_REACHED",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "org-uuid",
  "message": "Plan job limit reached...",
  "timestamp": "2025-01-16T10:30:00Z"
}
```

This enables instant support correlation: request_id → logs → audit trail → Stripe webhook correlation.

## Support

When reporting errors, always include:
- `request_id` from the error response
- `error_id` from the error response (for error tracking)
- `code` field
- Request parameters (sanitized)
- Client version/environment

---

**Last Updated:** 2025-01-16  
**Version:** 1.0.0

