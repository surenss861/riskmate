# RiskMate Reliability & Error Contract

**Public-Facing Error Handling Guarantees**

This document outlines RiskMate's error handling guarantees and reliability commitments. This is a public contract that defines how errors are handled, how incidents are tracked, and how clients can build reliable integrations.

## Error Response Guarantees

### Always Present

Every API response (success or error) **always** includes:

- **`request_id`**: Unique identifier for this HTTP request
- **`X-Request-ID` header**: Echoed in response headers

Every error response **always** includes:

- **`error_id`**: Unique identifier for this error instance
- **`X-Error-ID` header**: Echoed in response headers
- **`code`**: Machine-readable error code (namespaced)
- **`message`**: User-safe error description
- **`severity`**: Error severity (`error`, `warn`, `info`)
- **`category`**: Error category (`pagination`, `entitlements`, `auth`, `validation`, `internal`)
- **`classification`**: Error classification (`user_action_required`, `system_transient`, `developer_bug`)
- **`retryable`**: Whether the request can be retried
- **`retry_strategy`**: How to retry (`none`, `immediate`, `exponential_backoff`, `after_retry_after`)

### Traceability

- **Request Correlation**: `request_id` links requests to logs, audit trails, and support tickets
- **Error Aggregation**: `error_id` enables tracking error patterns across requests
- **Distributed Tracing**: W3C Trace Context (`traceparent`) is propagated when provided

## Retry Guarantees

### Retry Strategy

Errors include a `retry_strategy` field that determines retry behavior:

- **`none`**: Do not retry (4xx client errors)
- **`immediate`**: Retry immediately (rare, explicitly marked codes)
- **`exponential_backoff`**: Retry with exponential backoff (5xx server errors)
- **`after_retry_after`**: Wait for `retry_after_seconds` then retry (rate-limited errors)

**Guarantee**: Clients following `retry_strategy` will not cause retry storms or accidental DoS.

## Error Classification

Every error is classified for proper handling:

- **`user_action_required`**: User must take action (payment, upgrade, role change)
- **`system_transient`**: Temporary system issue (typically retryable)
- **`developer_bug`**: Client misconfiguration or bug

**Guarantee**: Errors are classified consistently, enabling proper triage and customer messaging.

## Support & Documentation

Every error includes:

- **`support_hint`**: Short, actionable guidance
- **`support_url`**: Direct link to runbook section (when available)
- **`documentation_url`**: Link to relevant documentation (when available)

**Guarantee**: Every error is documented with actionable guidance.

## Reliability Metrics

### Error Budget Tracking

- 5xx errors are automatically tracked by route and organization
- Error budget consumption is logged for monitoring
- Alerts can be configured based on error budget thresholds

### Observability

- All errors are logged with structured JSON
- Logs include: `request_id`, `error_id`, `organization_id`, `route`, `code`, `category`, `severity`
- Logs never include PII
- Full audit trail: `request_id → logs → audit trail → webhook correlation`

## Versioning

- **Current Version**: v1.0.0
- **Contract Status**: Frozen (stable)
- **Breaking Changes**: None allowed without major version bump
- **Deprecation Policy**: Legacy codes deprecated with 6-month notice

## Compliance

- **Audit Trail**: Full traceability via `request_id` and `error_id`
- **Incident Response**: Documented runbook links for all error codes
- **Error Classification**: Enables proper triage and compliance reporting
- **Structured Logging**: Queryable, PII-free logs

## Client Integration

### Recommended SDK Behavior

```typescript
// Auto-retry based on retry_strategy
if (error.retryable) {
  switch (error.retry_strategy) {
    case 'exponential_backoff':
      await retryWithBackoff(() => makeRequest());
      break;
    case 'after_retry_after':
      await sleep(error.retry_after_seconds * 1000);
      await makeRequest();
      break;
    case 'immediate':
      await makeRequest();
      break;
  }
}

// Auto-log request_id + error_id
logger.error('API Error', {
  request_id: error.request_id,
  error_id: error.error_id,
  code: error.code,
  classification: error.classification,
});
```

## Support

When reporting errors, always include:
- `request_id` from the error response
- `error_id` from the error response
- `code` field
- Request parameters (sanitized)

---

**Last Updated:** 2025-01-16  
**Contract Version:** v1.0.0  
**Status:** ✅ Active

