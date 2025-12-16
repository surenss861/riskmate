# API Error Contract v1.0.0

**Status:** Frozen (stable contract)  
**Last Updated:** 2025-01-16  
**Version:** 1.0.0

This document defines the **stable, versioned** error response format for the RiskMate API v1. All error responses follow this contract to ensure consistent client handling and support correlation.

## Standard Error Response Format

All error responses include:

```json
{
  "message": "Human-readable error message (user-safe)",
  "code": "ERROR_CODE",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "severity": "error" | "warn" | "info",
  "category": "pagination" | "entitlements" | "auth" | "validation" | "internal",
  "support_hint": "Short actionable guidance",
  "internal_message": "Detailed internal message (dev mode only)",
  // ... additional fields based on error type
}
```

### Common Fields

- **`message`** (string, required): User-safe, human-readable error description
- **`code`** (string, required): Machine-readable error code (namespaced, uppercase, underscore-separated)
- **`error_id`** (string, required): Unique error instance identifier (for error aggregation/tracking)
- **`request_id`** (string, required): Unique request identifier for correlation (echoes `X-Request-ID` header if provided)
- **`severity`** (string, required): Error severity level (`error`, `warn`, `info`)
- **`category`** (string, required): Error category for grouping (`pagination`, `entitlements`, `auth`, `validation`, `internal`)
- **`support_hint`** (string, optional): Short, actionable guidance (documentation_url provides detailed help)
- **`internal_message`** (string, optional): Detailed internal message (only in development mode)
- **`documentation_url`** (string, optional): Link to relevant documentation
- **`retry_after_seconds`** (number, optional): Seconds to wait before retrying (for rate-limited operations)

## Error Code Namespaces

Error codes use namespaces for clarity and organization:

- **`PAGINATION_*`**: Pagination-related errors
- **`ENTITLEMENTS_*`**: Subscription, limits, and feature access errors
- **`AUTH_*`**: Authentication and authorization errors
- **`VALIDATION_*`**: Input validation errors
- **`INTERNAL_*`**: Internal server errors

## Error Codes

### `PAGINATION_CURSOR_NOT_SUPPORTED`

**Status:** `400 Bad Request`  
**Category:** `pagination`  
**Severity:** `warn`

**When:** Client attempts to use cursor pagination with a sort mode that doesn't support it.

**Response:**
```json
{
  "message": "Cursor pagination is not supported for status sorting. Use offset pagination (page parameter) instead.",
  "code": "PAGINATION_CURSOR_NOT_SUPPORTED",
  "error_id": "660e8400-e29b-41d4-a716-446655440001",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "severity": "warn",
  "category": "pagination",
  "support_hint": "Remove cursor param or switch to page-based pagination",
  "sort": "status_asc",
  "reason": "Status sorting uses in-memory ordering which is incompatible with cursor pagination",
  "documentation_url": "/docs/pagination#status-sorting",
  "allowed_pagination_modes": ["offset"],
  "retry_after_seconds": 3600
}
```

---

### `ENTITLEMENTS_JOB_LIMIT_REACHED`

**Status:** `403 Forbidden`  
**Category:** `entitlements`  
**Severity:** `warn`

**When:** Monthly job creation limit has been reached for the current plan.

**Response:**
```json
{
  "message": "Plan job limit reached. Upgrade your plan to create more jobs.",
  "code": "ENTITLEMENTS_JOB_LIMIT_REACHED",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "severity": "warn",
  "category": "entitlements",
  "support_hint": "Upgrade plan or wait for monthly limit reset",
  "limit": 10,
  "current_count": 10,
  "plan": "starter"
}
```

---

### `ENTITLEMENTS_PLAN_PAST_DUE`

**Status:** `402 Payment Required`  
**Category:** `entitlements`  
**Severity:** `warn`

**When:** Subscription payment is past due.

**Response:**
```json
{
  "message": "Your subscription is not active. Update billing to create new jobs.",
  "code": "ENTITLEMENTS_PLAN_PAST_DUE",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "severity": "warn",
  "category": "entitlements",
  "support_hint": "Update payment method in billing settings",
  "subscription_status": "past_due"
}
```

---

### `ENTITLEMENTS_PLAN_INACTIVE`

**Status:** `402 Payment Required`  
**Category:** `entitlements`  
**Severity:** `warn`

**When:** Subscription is inactive or canceled.

**Response:**
```json
{
  "message": "Your subscription is not active. Please update billing to unlock this feature.",
  "code": "ENTITLEMENTS_PLAN_INACTIVE",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "severity": "warn",
  "category": "entitlements",
  "support_hint": "Reactivate subscription or upgrade plan",
  "subscription_status": "canceled"
}
```

---

### `ENTITLEMENTS_FEATURE_NOT_ALLOWED`

**Status:** `403 Forbidden`  
**Category:** `entitlements`  
**Severity:** `warn`

**When:** Feature is not available on the current plan.

**Response:**
```json
{
  "message": "Feature not available on your plan",
  "code": "ENTITLEMENTS_FEATURE_NOT_ALLOWED",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "severity": "warn",
  "category": "entitlements",
  "support_hint": "Upgrade plan to access this feature",
  "feature": "advanced_reports",
  "plan": "starter"
}
```

---

### `AUTH_ROLE_FORBIDDEN`

**Status:** `403 Forbidden`  
**Category:** `auth`  
**Severity:** `warn`

**When:** User lacks required role for the operation.

**Response:**
```json
{
  "message": "Only organization owners can delete jobs",
  "code": "AUTH_ROLE_FORBIDDEN",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "severity": "warn",
  "category": "auth",
  "support_hint": "This action requires owner role. Contact your organization owner",
  "required_role": "owner",
  "current_role": "admin"
}
```

---

### `INTERNAL_SERVER_ERROR`

**Status:** `500 Internal Server Error`  
**Category:** `internal`  
**Severity:** `error`

**When:** An unexpected server error occurs.

**Response:**
```json
{
  "message": "Internal server error",
  "code": "INTERNAL_SERVER_ERROR",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "severity": "error",
  "category": "internal"
}
```

---

### `UNKNOWN_ERROR`

**Status:** `400 Bad Request` (or other 4xx)  
**Category:** `internal`  
**Severity:** `warn`

**When:** An error occurs without a specific error code.

**Response:**
```json
{
  "message": "An error occurred",
  "code": "UNKNOWN_ERROR",
  "error_id": "uuid-v4",
  "request_id": "uuid-v4",
  "severity": "warn",
  "category": "internal"
}
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

**Echo Behavior:** If a client sends `X-Request-ID` header, the server will reuse it. Otherwise, a new UUID is generated. This helps when upstream gateways already stamp IDs.

## W3C Trace Context

The API supports W3C Trace Context propagation for enterprise observability stacks:

**Header:**
```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

If a reverse proxy or edge sends `traceparent` header, it will be propagated in the response. This enables integration with distributed tracing systems (Jaeger, Zipkin, Datadog, etc.).

## Error ID

Every error response includes an `error_id` field separate from `request_id`:

- **`request_id`**: Ties to one HTTP request
- **`error_id`**: Ties to the error instance/classification (useful for error aggregation)

This enables tracking error patterns across multiple requests.

## Support Console

All 4xx/5xx errors are automatically logged with structured JSON:

```json
{
  "level": "warn",
  "status": 403,
  "code": "ENTITLEMENTS_JOB_LIMIT_REACHED",
  "category": "entitlements",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "org-uuid",
  "message": "Plan job limit reached...",
  "internal_message": "Job limit exceeded: limit=10, current=10, plan=starter",
  "timestamp": "2025-01-16T10:30:00Z"
}
```

This enables instant support correlation: request_id → logs → audit trail → Stripe webhook correlation.

**Query Examples:**
- `show me all ENTITLEMENTS_PLAN_PAST_DUE in last 24h grouped by org`
- `top 10 error codes by count`
- `errors correlated to a specific request_id`
- `all errors in category=entitlements with severity=warn`

## Client Best Practices

1. **Always check `code` field** for programmatic error handling
2. **Use `request_id`** in support tickets and error logs
3. **Use `error_id`** for error pattern tracking
4. **Follow `support_hint`** for immediate actionable guidance
5. **Read `documentation_url`** for detailed guidance
6. **Respect `retry_after_seconds`** for rate-limited operations
7. **Check `severity` and `category`** for error grouping and dashboards

## Support

When reporting errors, always include:
- `request_id` from the error response
- `error_id` from the error response (for error tracking)
- `code` field
- `severity` and `category` fields
- Request parameters (sanitized)
- Client version/environment

## Versioning

This is **v1.0.0** of the error contract. Future versions will be documented in separate files (e.g., `API_ERRORS_v2.md`). Breaking changes will increment the major version.

---

**Contract Status:** ✅ Frozen (stable)  
**Breaking Changes:** None allowed without major version bump

