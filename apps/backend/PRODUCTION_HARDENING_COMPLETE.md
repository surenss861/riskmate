# Production Hardening Complete ✅

## Implemented Features

### 1. Observability ✅
- **Request ID Propagation**: All responses include `X-Request-ID` header
- **Structured Logging**: `logStructured()` and `logWithRequest()` with consistent fields:
  - `org_id`, `user_id`, `job_id`, `export_id`, `evidence_id`, `ledger_seq`, `request_id`
- **Worker Metrics**: `GET /api/metrics/exports` endpoint provides:
  - Queue depth by state
  - Average time in each state (queued → ready)
  - Failure rate by error category
- **Request ID in Exports**: `request_id` column added to `exports` table

### 2. Rate Limiting ✅
- **Export Rate Limiter**: 10 exports per hour per org
- **Upload Rate Limiter**: 100 uploads per day per org
- **Verification Rate Limiter**: 30 verifications per minute
- **Concurrent Export Limit**: Max 3 concurrent exports per org (enforced in worker)
- **Rate Limit Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`

### 3. Storage Lifecycle ✅
- **Retention Worker**: Runs hourly, cleans up expired exports
- **Retention Periods**:
  - Starter: 30 days
  - Pro: 90 days
  - Business: 365 days
  - Enterprise: 730 days
- **Failed Export Cleanup**: Removes failed/canceled exports after 7 days
- **Expired State**: New `expired` state in `export_state_enum`

### 4. Ledger Auditor-Proofing ✅
- **Daily Root Worker**: Computes Merkle roots for each org/day at 2 AM UTC
- **Ledger Roots Table**: Stores daily roots with event counts and hash ranges
- **Public Verification**: Token-based endpoint (`/api/public/verify/:token`)
  - No authentication required
  - 30-day token expiry
  - Returns manifest hash validation, ledger root, and chain status

### 5. Failure-Mode UX Contracts ✅
- **Enhanced Error Response**: Always includes:
  - `error_code`, `error_hint`, `retryable: bool`, `error_id`
  - `retry_strategy` (none/immediate/exponential_backoff/after_retry_after)
- **Poison Pill Logic**: Exports that fail 3 times are marked `failed` and stop retrying
- **Failure Count Tracking**: `failure_count` column in `exports` table

### 6. Verification Tokens ✅
- **Auto-Generated**: Every export gets a `verification_token` on creation
- **Public Access**: `GET /api/public/verify/:token` for sharing without login
- **Token Expiry**: 30 days from export creation
- **Verification URL**: Included in export status response

## Database Changes

Migration: `20251203000005_production_hardening.sql`
- Added `request_id` to `exports`
- Added `verification_token` to `exports` (unique index)
- Added `failure_count` to `exports`
- Added `expired` to `export_state_enum`
- Added `plan_tier` to `organizations` (default: 'starter')

## New Endpoints

- `GET /api/metrics/exports` - Worker metrics (queue depth, avg times, failure rates)
- `GET /api/public/verify/:token` - Public verification without auth

## Workers

1. **Export Worker**: Processes queued exports (already existed, enhanced with structured logging)
2. **Retention Worker**: Cleans up expired/failed exports (NEW)
3. **Ledger Root Worker**: Computes daily Merkle roots (NEW)

All workers start automatically on server boot.

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Export requests | 10 | 1 hour |
| Evidence uploads | 100 | 24 hours |
| Verification | 30 | 1 minute |
| Concurrent exports | 3 | Per org |

## Next Steps

1. **Deploy Migration**: Run `20251203000005_production_hardening.sql`
2. **Monitor Metrics**: Check `/api/metrics/exports` regularly
3. **Set Plan Tiers**: Update `organizations.plan_tier` based on subscription
4. **Test Public Verification**: Share verification tokens with stakeholders

## Monitoring Checklist

- [ ] Queue depth stays low (< 10 queued exports)
- [ ] Average export time < 2 minutes
- [ ] Failure rate < 5%
- [ ] Retention worker runs successfully
- [ ] Ledger roots computed daily
- [ ] Rate limits prevent abuse
- [ ] Public verification works without auth
