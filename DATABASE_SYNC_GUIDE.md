# Database Sync Guide: Web ↔ iOS ↔ Backend

This guide ensures your web app, iOS app, and backend all share the **same Supabase database** so data carries over seamlessly.

## 🎯 Goal

- **One database**: Web and iOS read/write to the same Supabase project
- **One auth system**: Same user account works on web and iOS
- **Data consistency**: Jobs, evidence, exports created on web appear on iOS (and vice versa)

---

## ✅ Step 1: Verify All Clients Point to Same Supabase Project

### Web App (Vercel/Next.js)

**Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key

**Where to check:**
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Or local `.env.local` file

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### iOS App

**Configuration File:**
- `mobile/Riskmate/Riskmate/Config.plist`

**Required Keys:**
- `SUPABASE_URL` - Same as web's `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` - Same as web's `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Example `Config.plist`:**
```xml
<dict>
    <key>BACKEND_URL</key>
    <string>https://your-railway-app.up.railway.app</string>
    <key>SUPABASE_URL</key>
    <string>https://xxxxx.supabase.co</string>
    <key>SUPABASE_ANON_KEY</key>
    <string>eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</string>
</dict>
```

### Backend (Railway)

**Environment Variables:**
- `SUPABASE_URL` - Same Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (backend only, never in clients!)

**Where to check:**
1. Railway Dashboard → Your Service → Variables

**Example:**
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (different from anon key)
```

---

## ✅ Step 2: Apply All Database Migrations

All migrations must be applied to the **same Supabase project** that all three clients are pointing to.

### Migration Order

Run these migrations in order in your Supabase SQL Editor:

1. `20251203000000_database_hardening_ledger_compliance.sql`
2. `20251203000001_ledger_trigger_safety_net.sql`
3. `20251203000002_fix_ledger_chain_of_custody.sql`
4. `20251203000003_fix_evidence_lifecycle.sql`
5. `20251203000004_export_worker_atomic_claim.sql` ⚠️ **This fixes the export worker error**

### How to Apply Migrations

**Option A: Supabase Dashboard (Recommended)**

1. Go to your Supabase Dashboard → SQL Editor
2. Copy the contents of each migration file
3. Paste and run in order
4. Verify each migration completes successfully

**Option B: Supabase CLI**

```bash
# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

### Verify Migration Applied

Run this SQL to check if `claim_export_job` exists:

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'claim_export_job';
```

**Expected Result:**
```
schema | function          | args
-------|-------------------|------------------
public | claim_export_job  | p_max_concurrent integer DEFAULT 3
```

If the function doesn't exist, run `20251203000004_export_worker_atomic_claim.sql` again.

### Refresh PostgREST Schema Cache

If the function exists but backend still can't find it:

```sql
SELECT pg_notify('pgrst', 'reload schema');
```

---

## ✅ Step 3: Verify Data Consistency

### Test: Create on Web, See on iOS

1. **On Web:**
   - Log in to your web app
   - Create a new job
   - Upload evidence
   - Generate an export

2. **On iOS:**
   - Log in with the **same account** (same email)
   - Navigate to Jobs list
   - **Expected**: You should see the job you created on web
   - Open the job → **Expected**: Evidence and exports should be visible

### Test: Create on iOS, See on Web

1. **On iOS:**
   - Log in
   - Create a new job
   - Upload evidence

2. **On Web:**
   - Refresh the page
   - **Expected**: New job appears in the list

---

## ✅ Step 4: Authentication Flow

### Web App Auth

- Uses Supabase Auth directly
- Stores JWT in cookies (via `@supabase/ssr`)
- User ID: `auth.users.id` in Supabase

### iOS App Auth

- Uses Supabase Auth via `AuthService.swift`
- Stores session in Keychain
- User ID: Same `auth.users.id` as web

### Backend Auth

- Verifies JWT from web/iOS requests
- Extracts `user_id` and `organization_id`
- Uses service role for admin operations only

**Key Point:** All three use the same `auth.users` table, so the same email/password works everywhere.

---

## ✅ Step 5: Data Flow Architecture

### Write Path (All Writes Go Through Backend)

```
Web/iOS → Backend API → Supabase (with service role) → Database
```

**Why?**
- Ensures ledger events are always recorded
- Enforces business rules (idempotency, validation)
- Maintains audit trail consistency

**Endpoints:**
- `POST /api/jobs` - Create job
- `POST /api/jobs/:id/evidence/upload` - Upload evidence
- `POST /api/jobs/:id/export/proof-pack` - Generate export
- `PATCH /api/controls/:id` - Complete control

### Read Path (Hybrid)

**Option 1: Via Backend (Recommended for complex queries)**
```
Web/iOS → Backend API → Supabase → Database
```

**Option 2: Direct Supabase (For simple reads, with RLS)**
```
Web/iOS → Supabase (with anon key + RLS) → Database
```

**RLS ensures:**
- Users can only read data from their organization
- Executives are read-only
- Cross-org access is blocked

---

## ✅ Step 6: Organization Context

All data is scoped by `organization_id`:

- `jobs.organization_id`
- `evidence.organization_id`
- `exports.organization_id`
- `audit_logs.organization_id`

**RLS Policies:**
- Users can only access data where `organization_id` matches their membership
- Backend enforces this at the API level too (defense in depth)

---

## 🔧 Troubleshooting

### Problem: "Data doesn't appear on iOS after creating on web"

**Check:**
1. ✅ Same Supabase URL in both?
2. ✅ Same user account (same email)?
3. ✅ User is member of same organization?
4. ✅ RLS policies allow read access?

**Fix:**
- Verify `Config.plist` has correct `SUPABASE_URL`
- Check iOS logs for auth errors
- Verify user's `organization_id` matches

### Problem: "Export worker error: Could not find function claim_export_job"

**Check:**
1. ✅ Migration `20251203000004_export_worker_atomic_claim.sql` applied?
2. ✅ Function exists in `public` schema?
3. ✅ PostgREST schema cache refreshed?

**Fix:**
```sql
-- Apply migration
-- Then refresh cache
SELECT pg_notify('pgrst', 'reload schema');
```

### Problem: "User can't log in on iOS with web credentials"

**Check:**
1. ✅ Same Supabase project?
2. ✅ Same anon key?
3. ✅ User exists in `auth.users`?

**Fix:**
- Verify `Config.plist` matches web env vars
- Check Supabase Auth dashboard for user
- Try resetting password on web, then use new password on iOS

### Problem: "RLS blocking reads"

**Check:**
1. ✅ User is member of organization?
2. ✅ RLS policies are correct?
3. ✅ Using anon key (not service role) in clients?

**Fix:**
- Check `organization_members` table
- Verify RLS policies in Supabase dashboard
- Never use service role key in web/iOS apps

---

## 📋 Quick Verification Checklist

- [ ] Web `NEXT_PUBLIC_SUPABASE_URL` = iOS `SUPABASE_URL` = Backend `SUPABASE_URL`
- [ ] Web `NEXT_PUBLIC_SUPABASE_ANON_KEY` = iOS `SUPABASE_ANON_KEY`
- [ ] Backend has `SUPABASE_SERVICE_ROLE_KEY` (different from anon key)
- [ ] All migrations applied to Supabase (especially `claim_export_job`)
- [ ] Same user account works on web and iOS
- [ ] Data created on web appears on iOS
- [ ] Data created on iOS appears on web
- [ ] Export worker no longer shows "function not found" errors

---

## 🚀 Next Steps

Once everything is synced:

1. **Test end-to-end:**
   - Create job on web → See on iOS
   - Upload evidence on iOS → See on web
   - Generate export on web → Download on iOS

2. **Monitor logs:**
   - Railway backend logs (should show successful RPC calls)
   - Supabase logs (should show RLS working correctly)

3. **Production readiness:**
   - All three environments (web, iOS, backend) point to production Supabase
   - All migrations applied
   - RLS policies tested
   - Export worker using atomic claims

---

## 📚 Related Documentation

- `SUPABASE_SETUP.md` - Initial Supabase setup
- `apps/backend/RAILWAY_VERIFICATION.md` - Backend verification
- `mobile/Riskmate/CONFIG_SETUP.md` - iOS config setup
