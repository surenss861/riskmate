# Riskmate Improvement Plan – Status

Track of items from the comprehensive improvement plan vs what’s done or pending.

---

## Quick wins (90 min block)

| Task | Status | Notes |
|------|--------|------|
| Export DB schema | ✅ Migration ready | Run `20260201000000_ensure_exports_requested_at.sql` in Supabase (see APPLY_MIGRATIONS.md) |
| Remove debug logs | ✅ Done | iOS Config + RiskmateApp; backend BOOT/SUPABASE markers optional to trim |
| PDF branding | ✅ Done | "RiskMate" → "Riskmate" in all PDF/report generation (backend, lib, pdf-service) |
| DB indexes | ✅ In migration | `idx_exports_requested_at` in same migration as `requested_at` |
| Permit pack route | ✅ Done | POST `/api/jobs/:id/permit-pack` → 308 to `/api/reports/permit-pack/:id` |

---

## Critical (Week 1)

| Task | Status | Notes |
|------|--------|------|
| Export schema fix | ⏳ Pending apply | Migration written; apply in Supabase SQL Editor |
| Web auth headers | ⏳ To verify | Executive brief already sends `Authorization: Bearer` when session exists; 401s may be expired/missing session – confirm which flows fail |
| Error handling | 🟡 Partial | Export error messages improved (ExportErrorMessages.swift, backend); retry/structured codes as in plan still optional |

---

## High priority (Week 2)

| Task | Status | Notes |
|------|--------|------|
| Rate limiting | ⏳ Not started | Plan: express-rate-limit on /api and strict limit on export |
| Failed auth logging | ⏳ Not started | Plan: track reason (expired/malformed/missing), optional alert after N failures |
| Validation layer | 🟡 Partial | Jobs search validated; team invite email regex; Joi/schemas for all routes not done |

---

## Medium priority (ongoing)

| Task | Status | Notes |
|------|--------|------|
| Orphaned cleanup | ⏳ Not started | RetentionWorker logs "skipped (not implemented)"; implement when ready |
| Analytics enhancement | ⏳ Not started | Performance/error aggregation as in plan |
| Offline queue | 🟡 Partial | OfflineCache + exponential backoff and max retries in place |
| Accessibility | ⏳ Not started | VoiceOver/ARIA as in plan |

---

## Nice-to-have (future)

| Task | Status | Notes |
|------|--------|------|
| Feature flags | ⏳ Not started | Plan: rollout %, org/user allowlists |
| Automated testing | 🟡 Partial | Some backend/iOS tests; E2E/Playwright as in plan not done |
| Advanced monitoring | ⏳ Not started | Health checks (DB, storage, workers) as in plan |

---

## Done this session (summary)

- **PDF branding:** All user-facing PDF/report strings and email subjects use "Riskmate" (backend routes/audit, executive, team, notifications; backend utils/pdf; lib/utils/pdf; lib/pdf/reports; pdf-service; permitPack filename). Marketing/UI/product name left as-is.
- **Permit pack:** Backend alias route already in place.
- **Export migration:** Already added; apply in Supabase.
- **Debug logs:** iOS config and RiskmateApp debug prints already removed.
- **15 bug fixes:** Applied earlier (file ops, thread safety, SQL injection, verification hash, etc.).

---

## Next actions

1. **Apply export migration** in Supabase (see APPLY_MIGRATIONS.md) so exports stop returning 500.
2. **Repro 401s** on web export endpoints (which URL, logged-in vs not, token in request) to confirm if it’s session expiry or missing token.
3. **Optional:** Add rate limiting and failed-auth tracking per plan when prioritizing Week 2.

Last updated: 2026-02-02
