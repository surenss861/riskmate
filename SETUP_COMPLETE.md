# ✅ Database Sync Setup Complete

## What Was Built

### 1. **Comprehensive Documentation**
   - `DATABASE_SYNC_GUIDE.md` - Complete guide for web/iOS/backend sync
   - `APPLY_MIGRATIONS.md` - Migration application guide
   - `QUICK_SETUP_MIGRATION.md` - Quick fix for `claim_export_job` error

### 2. **Automated Scripts**
   - `scripts/setup-database-sync.sh` - Interactive setup script
   - `scripts/verify-database-sync.sh` - Configuration verification

### 3. **Improved Error Handling**
   - Export worker now logs RPC warnings once per minute (not every poll)
   - Graceful fallback when RPC doesn't exist
   - Clear error messages pointing to migration file

---

## 🎯 Next Steps (Do These Now)

### Step 1: Apply Migration to Supabase

**Quick Method:**
1. Go to https://app.supabase.com → Your Project → SQL Editor
2. Open `supabase/migrations/20251203000004_export_worker_atomic_claim.sql`
3. Copy entire file → Paste in SQL Editor → Run

**Verify:**
```sql
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'claim_export_job';
```

Should return: `public | claim_export_job | p_max_concurrent integer DEFAULT 3`

### Step 2: Refresh PostgREST Cache

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

### Step 3: Verify Configuration

Run the verification script:
```bash
./scripts/verify-database-sync.sh
```

Or manually check:
- Web `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- iOS `Config.plist`: `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Railway Variables: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

**All three must point to the SAME Supabase project URL.**

### Step 4: Restart Railway Backend

Railway will auto-redeploy on next push, or manually redeploy from dashboard.

### Step 5: Test

1. **Backend:** Check Railway logs - should see "claimed export job via RPC" (no more errors)
2. **Web:** Create a job → Upload evidence → Generate export
3. **iOS:** Log in with same account → See job from web → Upload evidence → See on web

---

## ✅ Verification Checklist

- [ ] Migration `20251203000004_export_worker_atomic_claim.sql` applied
- [ ] `claim_export_job` function exists (verified with SQL)
- [ ] PostgREST cache refreshed
- [ ] Web, iOS, and backend all use same `SUPABASE_URL`
- [ ] Web and iOS use same `SUPABASE_ANON_KEY`
- [ ] Backend has `SUPABASE_SERVICE_ROLE_KEY` (different from anon key)
- [ ] Railway backend restarted
- [ ] Export worker no longer shows "function not found" errors
- [ ] Data created on web appears on iOS
- [ ] Data created on iOS appears on web

---

## 📚 Documentation Reference

- **Quick Fix:** `QUICK_SETUP_MIGRATION.md`
- **Full Guide:** `DATABASE_SYNC_GUIDE.md`
- **All Migrations:** `APPLY_MIGRATIONS.md`
- **Setup Script:** `./scripts/setup-database-sync.sh`
- **Verify Script:** `./scripts/verify-database-sync.sh`

---

## 🚀 Architecture Summary

### Data Flow

```
┌─────────┐         ┌─────────┐
│   Web   │────────▶│ Backend │────────▶ Supabase (Service Role)
│   iOS   │────────▶│   API   │         - All writes go here
└─────────┘         └─────────┘         - Ledger events recorded
     │                                      - Idempotency enforced
     │
     └─────────────────────────────────▶ Supabase (Anon Key + RLS)
                                          - Safe reads only
                                          - RLS enforces org boundaries
```

### Key Principles

1. **One Database:** All clients point to same Supabase project
2. **One Auth:** Supabase Auth for web and iOS (same user accounts)
3. **Writes via Backend:** All mutations go through backend API
4. **Reads Hybrid:** Direct Supabase (with RLS) or via backend
5. **RLS Everywhere:** Organization boundaries enforced at DB level

---

## 🎉 You're Ready!

Once the migration is applied and configuration verified, your web and iOS apps will share the same database seamlessly. Data created on one platform will immediately appear on the other.
