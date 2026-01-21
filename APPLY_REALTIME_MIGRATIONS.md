# Apply Realtime Migrations Directly

**Since older migrations have conflicts, apply the realtime migrations directly in Supabase SQL Editor.**

---

## Step 1: Open Supabase SQL Editor

1. Go to Supabase Dashboard
2. Click "SQL Editor" in left sidebar
3. Click "New query"

---

## Step 2: Apply Realtime Events Table Migration

**Copy and paste** the contents of:
`supabase/migrations/20250126000000_add_realtime_events_table.sql`

**Then click "Run"**

**Verify**:
- [ ] No errors
- [ ] Table `realtime_events` exists
- [ ] RLS is enabled
- [ ] Indexes created

---

## Step 3: Apply Observability Views Migration

**Copy and paste** the contents of:
`supabase/migrations/20250126000001_add_realtime_observability.sql`

**Then click "Run"**

**Verify**:
- [ ] No errors
- [ ] Views exist:
  - `realtime_events_hourly_stats`
  - `realtime_events_dedupe_stats`
  - `realtime_events_cleanup_stats`

---

## Step 4: Enable Realtime (If Not Already)

**Run**:

```sql
-- Check if already enabled
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'realtime_events';

-- If no rows returned, enable it:
ALTER PUBLICATION supabase_realtime ADD TABLE realtime_events;
```

---

## Step 5: Verify Everything

**Run**:

```sql
-- Check table exists
SELECT * FROM realtime_events LIMIT 1;

-- Check views work
SELECT * FROM realtime_events_hourly_stats LIMIT 1;
SELECT * FROM realtime_events_dedupe_stats LIMIT 1;
SELECT * FROM realtime_events_cleanup_stats LIMIT 1;

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'realtime_events';

-- Should show: rowsecurity = true
```

**All checks should pass.** ✅

---

**After this, proceed to Step 2 in `PRODUCTION_DEPLOYMENT_EXECUTION.md`** (Railway backend deployment).
