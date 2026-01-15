# Production Hardening Checklist

## ✅ Completed

### 1. Golden Path Test Suite
- **File**: `scripts/golden-path-test.ts`
- **Tests**:
  - Evidence upload (normal + idempotency)
  - Export request → poll → download
  - Verify ledger event
  - Verify manifest
- **Usage**: `BACKEND_URL=... JWT_TOKEN=... JOB_ID=... pnpm test:golden-path`

### 2. Atomic Export Claiming
- **Migration**: `supabase/migrations/20251203000004_export_worker_atomic_claim.sql`
- **RPC Function**: `claim_export_job()` uses `FOR UPDATE SKIP LOCKED`
- **Fallback**: Optimistic locking if RPC doesn't exist
- **Documentation**: `CONCURRENCY.md`

### 3. Evidence Upload Validation
- **File Size Limit**: 50MB max
- **Content Type Allowlist**: Images (JPEG, PNG, GIF, WebP), PDF, Videos (MP4, QuickTime), Documents (Word)
- **Early Rejection**: Invalid multipart form data rejected before processing

### 4. Canonical JSON Hash Consistency
- **File**: `apps/backend/src/routes/verification.ts`
- **Matching**: Hash computation matches DB function exactly:
  - Same key order (jsonb_build_object insertion order)
  - Same formatting (jsonb_pretty with 2-space indentation)
  - Same null handling (COALESCE to empty string)
  - Same salt

## 🔄 Pending

### 5. RLS & Permission Tests
- **Script**: `scripts/test-rls-permissions.sh`
- **Tests**: Org boundary checks for evidence, exports, audit_logs
- **Status**: Script created, needs execution with real tokens

### 6. Multi-Instance Testing
- **Test**: Run 2+ Railway instances, verify no duplicate exports
- **Monitor**: Watch for jobs stuck in `preparing` state
- **Status**: Requires Railway deployment

## 📋 Testing Checklist

Before deploying to production:

- [ ] Run golden path tests against staging backend
- [ ] Verify evidence upload idempotency (same key = same record)
- [ ] Verify export worker processes jobs without duplicates
- [ ] Test hash verification matches DB computation
- [ ] Test manifest verification against real exports
- [ ] Run RLS permission tests (Org A cannot access Org B)
- [ ] Test with 2+ backend instances (no duplicate exports)
- [ ] Verify file size limits enforced
- [ ] Verify content type allowlist enforced
- [ ] Monitor export queue depth (workers keeping up)

## 🚨 Production Monitoring

Watch for:
- Export jobs stuck in `preparing` state > 5 minutes (worker crashed)
- Duplicate exports (concurrency bug)
- High `queued` export count (workers not keeping up)
- Hash verification mismatches (canonical JSON bug)
- Evidence upload failures (storage quota, network issues)

## 🔧 Future Improvements

1. **Worker Heartbeat**: Track which worker claimed which job
2. **Timeout Recovery**: Reset stuck jobs from `preparing` → `queued` after timeout
3. **SHA Deduplication**: Return existing evidence if same SHA256 already exists
4. **Server-Side Manifest Verification**: Accept `export_id` only, verify stored manifest
5. **Split Worker Process**: Separate deployment for export worker (cleaner scaling)
