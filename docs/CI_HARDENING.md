# CI Hardening Guide

## Overview

The PDF smoke test CI workflow includes production-grade hardening to ensure reliable, fast, and secure test execution.

## Key Features

### 1. Concurrency Guard

Prevents duplicate test suites when multiple commits are pushed rapidly:

```yaml
concurrency:
  group: pdf-smoke-${{ github.ref }}
  cancel-in-progress: true
```

- Cancels in-progress runs when a new commit is pushed
- Saves CI minutes and prevents confusion from overlapping results
- Per-branch grouping ensures PR and main runs don't interfere

### 2. Matrix Strategy (Parallel Execution)

All 4 packet types run in parallel for faster CI:

```yaml
strategy:
  fail-fast: false
  matrix:
    packet:
      - label: AUDIT
      - label: INCIDENT
      - label: COMPLIANCE
      - label: INSURANCE
```

**Benefits:**
- 4x faster than sequential execution
- Each packet type runs independently
- `fail-fast: false` ensures all tests complete even if one fails
- Cleaner logs with per-packet job names

### 3. Intelligent Retry Logic

Only retries on known transient failures:

**Retries on:**
- `net::ERR_*` (network errors)
- `Timeout` (navigation timeout)
- `Target closed` (browser closed unexpectedly)
- `Execution context destroyed` (browser crash)
- `Navigation timeout` (page load timeout)

**Does NOT retry on:**
- HTTP errors (401/403/404/500)
- Missing selectors after successful load
- Authentication failures
- Invalid URLs

**Implementation:**
```typescript
const isTransient = 
  errorMsg.includes('net::ERR_') ||
  errorMsg.includes('Timeout') ||
  errorMsg.includes('Target closed') ||
  errorMsg.includes('Execution context destroyed') ||
  errorMsg.includes('Navigation timeout')

if (retries > 0 && isTransient) {
  // Retry logic
} else {
  // Fail immediately
}
```

### 4. Artifact Naming with Attempt Numbers

Screenshots include run attempt numbers to prevent overwrites:

**Format:** `{PACKET_LABEL}__attempt{N}__cover.png`

**Examples:**
- `AUDIT__cover.png` (first attempt)
- `AUDIT__attempt2__cover.png` (second attempt after retry)
- `INCIDENT__attempt3__error.png` (error screenshot from third attempt)

**Benefits:**
- Debug retries by comparing attempt screenshots
- No data loss from overwrites
- Clear artifact organization

### 5. URL Redaction

All URLs are logged with tokens masked for security:

```typescript
console.log(`📍 URL: ${finalUrl.replace(/\?token=[^&]+/, '?token=***')}`)
```

**Example output:**
```
📍 URL: https://riskmate.vercel.app/reports/packet/print/abc123?token=***
```

**Security benefits:**
- Tokens never appear in logs
- GitHub automatically masks secrets, but redaction provides extra safety
- Safe to share logs for debugging

### 6. Token TTL Considerations

**Important:** `PDF_TEST_TOKEN` should be long-lived for CI.

**If token expires:**
- Tests will fail with 401/403 errors
- No retry logic (authentication failures are not retried)
- Tests will appear "randomly" broken

**Best practices:**
- Use a dedicated CI service account token
- Set token expiration to match your CI requirements (e.g., 1 year+)
- Document token rotation process
- Monitor token expiration and rotate proactively

## Configuration

### Required Secrets

```bash
PDF_TEST_URL_AUDIT      # Print URL for audit packet
PDF_TEST_URL_INCIDENT   # Print URL for incident packet
PDF_TEST_URL_COMPLIANCE # Print URL for compliance packet
PDF_TEST_URL_INSURANCE  # Print URL for insurance packet
PDF_TEST_TOKEN          # Authentication token (long-lived)
```

### Token Requirements

- **Long-lived:** Should not expire during active CI usage
- **Scoped:** Read-only access to print URLs (if possible)
- **Dedicated:** Use a service account, not a personal account

## Troubleshooting

### Tests "Randomly" Fail

**Check:**
1. Token expiration - verify `PDF_TEST_TOKEN` is still valid
2. URL validity - ensure test URLs haven't changed or been deleted
3. Network issues - check for transient network failures

### Duplicate Runs

**Solution:** Concurrency guard should prevent this, but if you see duplicates:
1. Check workflow file has `concurrency` block
2. Verify `cancel-in-progress: true` is set
3. Check GitHub Actions settings allow concurrent runs

### Slow CI

**Optimizations:**
- Matrix strategy already runs packets in parallel
- Consider running only 2 packets on PRs, all 4 on main
- Reduce timeout if tests complete faster than configured

### Artifact Overwrites

**Solution:** Artifact naming includes attempt numbers, so overwrites shouldn't occur. If you see overwrites:
1. Check `GITHUB_RUN_ATTEMPT` is being used
2. Verify label includes attempt number in screenshot filenames

## Future Enhancements

- **Healthcheck URLs:** Quick GET before Playwright to verify token + 200
- **Dedicated CI Test Job:** Seeded test job in DB instead of hardcoded URLs
- **Visual Regression:** Pixel-diff comparisons against golden baselines
- **PR vs Main Strategy:** Different packet sets for PRs vs main

