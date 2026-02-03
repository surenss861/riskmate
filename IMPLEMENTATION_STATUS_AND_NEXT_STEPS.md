# Implementation Status & Next Steps

## ✅ Completed

### Quick wins (5/5 ready)
- **PDF branding** – "RiskMate" → "Riskmate" (13+ files)
- **Debug cleanup** – iOS Config + RiskmateApp logs removed
- **Permit pack** – POST `/api/jobs/:id/permit-pack` → 308 redirect
- **15 bug fixes** – File ops, thread safety, SQL injection, verification, etc. (see `BUG_FIXES_2026_02_01.md`)
- **Export migration** – SQL ready; apply in Supabase to unblock exports

### Progress
| Category        | Done | Pending | %    |
|----------------|------|---------|------|
| Quick wins     | 4/5  | 1 (run SQL) | 80% |
| Critical       | 1/3  | 2        | 33% |
| High priority  | 0/4  | 4        | 0%  |
| Medium         | 0/8  | 8        | 0%  |

---

## 🚨 Critical next step (5 min)

**Apply export migration** so exports return 200 instead of 500:

1. Open **Supabase SQL Editor**: https://supabase.com/dashboard/project/xwxghduwkzmzjrbpzwwq/sql  
2. Run:

```sql
ALTER TABLE exports
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

UPDATE exports SET requested_at = created_at WHERE requested_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exports_requested_at ON exports(requested_at DESC);

SELECT pg_notify('pgrst', 'reload schema');
```

3. Restart backend: `railway restart --service backend`  
4. Test: iOS or web → Job → Export → should get 200 OK.

---

## High priority remaining

1. **Web auth headers (1 hr)** – Export endpoints return 401; ensure all web export calls send `Authorization: Bearer <token>` (e.g. via shared `apiRequest` wrapper).  
2. **Enhanced error handling (2 hr)** – Structured error codes, `userMessage`, retry hints; iOS retry + alerts.  
3. **Rate limiting (1 hr)** – `express-rate-limit` on `/api`, stricter on export/auth.  
4. **Extra DB indexes (5 min)** – Optional; see improvement plan for `jobs`, `audit_events`, `evidence`, `exports.status`.

---

## Recommended order

**Today (~30 min):** Apply export migration → restart backend → test export.  
**This week (~4 hr):** Web auth fix → error handling → rate limiting.  
**Later:** Medium-priority items (auth logging, orphaned cleanup, analytics, validation, etc.).

---

## Docs

- `APPLY_MIGRATIONS.md` – How to run migrations  
- `BUG_FIXES_2026_02_01.md` – 15 bug fixes  
- `IMPROVEMENT_PLAN_STATUS.md` – Full plan vs status  

Last updated: 2026-02-03
