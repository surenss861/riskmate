# How to Fix the 500 Errors - Apply Database Migrations

The 500 errors you're seeing are caused by **RLS (Row-Level Security) recursion** in your Supabase database. The code fixes are deployed, but you need to apply the SQL migrations to your database.

## Quick Fix Steps

1. **Go to your Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your RiskMate project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Apply Migration 1** (Required - fixes the core recursion issue)
   - Copy the entire contents of: `supabase/migrations/20250122000002_fix_rls_recursion_with_security_definer_helpers.sql`
   - Paste into the SQL Editor
   - Click "Run" (or press Cmd+Enter / Ctrl+Enter)
   - Wait for it to complete

4. **Apply Migration 2** (Required - fixes templates and api_keys)
   - Copy the entire contents of: `supabase/migrations/20250122000003_fix_other_tables_rls_recursion.sql`
   - Paste into the SQL Editor
   - Click "Run"
   - Wait for it to complete

5. **Verify the fix**
   - Refresh your Compliance Ledger page
   - The `/api/audit/events` endpoint should now return 200
   - Buttons should work

## What These Migrations Do

- **Migration 1**: Creates SECURITY DEFINER helper functions (`is_org_member`, `org_role`) that bypass RLS, then rewrites all policies to use them instead of querying `organization_members` directly (which caused infinite recursion)

- **Migration 2**: Fixes `templates` and `api_keys` tables that also had recursive policies

## If You See Errors When Running

- **"function already exists"**: The migration might have partially run. You can skip the CREATE FUNCTION parts if they already exist.
- **"policy does not exist"**: The DROP POLICY IF EXISTS handles this gracefully, so this is fine.
- **Permission errors**: Make sure you're running as a database admin/owner role.

## Alternative: Run via Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

This will apply all pending migrations automatically.

