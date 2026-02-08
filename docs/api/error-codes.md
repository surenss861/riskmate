# API Error Codes Reference

This document describes the standardized error codes used across RiskMate API routes. All error responses follow a consistent schema with enhanced fields for client retry logic, support correlation, and debugging.

## Error Response Schema

All API error responses include:

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Always `false` for errors |
| `message` | string | User-safe error message |
| `code` | string | Stable error code (use for programmatic handling) |
| `error_id` | string | Unique UUID for this error instance (correlate with support) |
| `request_id` | string | Request ID for tracing |
| `severity` | "error" \| "warn" \| "info" | Severity level |
| `category` | string | Error category (auth, validation, entitlements, internal, pagination) |
| `classification` | string | Triage classification (user_action_required, developer_bug, system_transient) |
| `retryable` | boolean | Whether the client should retry |
| `retry_strategy` | string | Retry guidance: `none`, `immediate`, `exponential_backoff`, `after_retry_after` |
| `error_hint` | string \| null | Short actionable guidance |
| `support_url` | string | Link to runbook documentation (when available) |
| `retry_after_seconds` | number | For 429: seconds to wait before retry |
| `details` | object | Additional context (schema varies by error) |

## Response Headers

- `X-Error-ID`: Same as `error_id` in body (for clients that parse headers first)
- `X-Request-ID`: Request correlation ID
- `Retry-After`: For 429 responses, seconds until rate limit resets

## Error Codes

### Auth Errors

| Code | HTTP Status | Message | Hint | Category | Classification |
|------|-------------|---------|------|----------|----------------|
| UNAUTHORIZED | 401 | Unauthorized: Please log in... | Log in again and retry | auth | user_action_required |
| AUTH_INVALID_TOKEN | 401 | Invalid or expired token | Log in again and retry | auth | user_action_required |
| AUTH_ROLE_FORBIDDEN | 403 | Permission denied | This action requires owner role. Contact your organization owner | auth | user_action_required |
| FORBIDDEN | 403 | You do not have permission... | You do not have permission to perform this action | auth | user_action_required |

### Validation Errors

| Code | HTTP Status | Hint | Retry Strategy |
|------|-------------|------|----------------|
| VALIDATION_ERROR | 400 | Check request parameters and retry | none |
| MISSING_REQUIRED_FIELD | 400 | Provide all required fields and retry | none |
| INVALID_FORMAT | 400 | Check field format and allowed values | none |
| NOT_FOUND | 404 | null | none |

### Database Errors

| Code | HTTP Status | Hint | Retry Strategy |
|------|-------------|------|----------------|
| QUERY_ERROR | 500 | Retry the request. If the problem persists, contact support. | exponential_backoff |
| RLS_RECURSION_ERROR | 500 | Database policy configuration issue. Contact support with error ID. | exponential_backoff |
| CONNECTION_ERROR | 500 | Database connection failed. Retry the request. | exponential_backoff |

### Rate Limit

| Code | HTTP Status | Hint | Retry Strategy |
|------|-------------|------|----------------|
| RATE_LIMIT_EXCEEDED | 429 | Wait for the rate limit to reset or upgrade your plan. | after_retry_after |

### Export Errors

| Code | HTTP Status | Hint | Retry Strategy |
|------|-------------|------|----------------|
| EXPORT_ERROR | 500 | Retry the export. If the problem persists, contact support. | exponential_backoff |
| PDF_GENERATION_ERROR | 500 | Retry generating the PDF. If the problem persists, contact support. | exponential_backoff |

### Entitlement Errors

| Code | HTTP Status | Hint |
|------|-------------|------|
| ENTITLEMENTS_JOB_LIMIT_REACHED | 403 | Upgrade plan or wait for monthly limit reset |
| ENTITLEMENTS_PLAN_PAST_DUE | 403 | Update payment method in billing settings |
| ENTITLEMENTS_PLAN_INACTIVE | 403 | Reactivate subscription or upgrade plan |
| ENTITLEMENTS_FEATURE_NOT_ALLOWED | 403 | Upgrade plan to access this feature |

### Pagination

| Code | HTTP Status | Hint |
|------|-------------|------|
| PAGINATION_CURSOR_NOT_SUPPORTED | 400 | Remove cursor param or switch to page-based pagination |

## Retry Strategy Guide

| Strategy | When | Client Action |
|----------|------|---------------|
| `none` | 4xx client errors | Do not retry. Fix request and try again. |
| `immediate` | Transient issues | Retry once immediately. |
| `exponential_backoff` | 5xx server errors | Retry with exponential backoff (1s, 2s, 4s, ...). |
| `after_retry_after` | 429 rate limited | Wait `retry_after_seconds`, then retry. |

## Example Response

```json
{
  "ok": false,
  "message": "Rate limit exceeded. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "error_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "request_id": "req-abc-123",
  "severity": "warn",
  "category": "internal",
  "classification": "user_action_required",
  "retryable": true,
  "retry_strategy": "after_retry_after",
  "error_hint": "Wait for the rate limit to reset or upgrade your plan.",
  "support_url": "/support/runbooks/rate-limits#exceeded",
  "retry_after_seconds": 60,
  "details": {
    "limit": 10,
    "window": "1 hour",
    "resetAt": 1234567890
  }
}
```

## Support Correlation

When contacting support, provide:

1. **Error ID** (`error_id` or `X-Error-ID` header) – unique to each error instance
2. **Request ID** (`request_id` or `X-Request-ID` header) – traces the full request
3. **Error code** – stable identifier for the error type

Support can use these to correlate with server logs and identify the exact failure.
