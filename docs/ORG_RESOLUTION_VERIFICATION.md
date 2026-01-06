# Organization Resolution Verification Guide

## Current Auth Model

**Source of Truth**: `users.organization_id` (single organization per user)

- Each user has a direct `organization_id` foreign key in the `users` table
- **This is the primary source of truth** - no separate `organization_members` or `org_members` table is used for resolution
- `resolveOrgContext()` reads from `users.organization_id` and verifies the organization exists
- RLS policies use `get_user_organization_id()` function which reads from `users.organization_id`

**Note**: There is an `organization_members` table in the schema (for future multi-org support), but it's not currently used for org resolution. The current implementation is single-org-per-user.

## Verification Endpoints

### 1. `/api/debug/whoami`
**Purpose**: Quick check of org resolution for the current user

**Returns**:
- `orgIdHash`: Hashed organization ID
- `orgName`: Organization name from database
- `role`: User role (executive/owner/admin/member)
- `resolvedFrom`: How org was resolved (currently always "profile")
- `dataAccess`: Quick counts of jobs/incidents accessible

**Usage**:
```bash
curl https://your-domain.com/api/debug/whoami
```

### 2. `/api/debug/verify-org-scoping`
**Purpose**: Comprehensive verification of org isolation and query scoping

**Returns**:
- Org context details
- Verification results for each table (jobs, incidents, report_runs)
- Checks for data leakage (rows with wrong organization_id)
- Org name validation
- Summary with recommendations

**Usage**:
```bash
curl https://your-domain.com/api/debug/verify-org-scoping
```

### 3. Debug Headers (Non-Prod Only)

When `NODE_ENV !== 'production'` or `ENABLE_DEBUG_HEADERS=true`, these endpoints return headers:

**`/api/executive/risk-posture`**:
- `X-Org-Id-Hash`
- `X-User-Id-Hash`
- `X-Resolved-From`
- `X-Org-Name`
- `X-Time-Range`
- `X-Data-Window-Start`
- `X-Data-Window-End`

**`/api/executive/brief/pdf`**:
- `X-Org-Id-Hash`
- `X-User-Id-Hash`
- `X-Resolved-From`
- `X-Org-Name`
- `X-Time-Range`

## Verification Checklist

### ✅ Step 1: Verify Org Resolution
1. Call `/api/debug/whoami`
2. Confirm `orgIdHash` is stable across requests
3. Confirm `orgName` matches expectations (not email-based)
4. Confirm `role` matches UI expectations

### ✅ Step 2: Verify Consistency Across Endpoints
1. Call `/api/debug/whoami` → note `orgIdHash`
2. Call `/api/executive/risk-posture?time_range=30d` → check `X-Org-Id-Hash` header
3. Call `/api/executive/brief/pdf` → check `X-Org-Id-Hash` header
4. **All three should have the same `orgIdHash`**

### ✅ Step 3: Verify Org Isolation
1. **Org A user**: Create 2 jobs (1 high risk), 1 incident
2. **Org B user**: Create 5 jobs (0 high risk), 0 incidents
3. Each org generates PDF → should show different numbers
4. Use `/api/debug/verify-org-scoping` to check for data leakage

### ✅ Step 4: Verify Query Scoping
Every query in `/api/executive/risk-posture` must include:
```typescript
.eq('organization_id', orgContext.orgId)
```

Tables that must be org-scoped:
- `jobs` → `.eq('organization_id', orgContext.orgId)`
- `incidents` → `.eq('organization_id', orgContext.orgId)`
- `report_runs` → `.eq('organization_id', orgContext.orgId)`
- `report_signatures` → filtered via `report_runs.organization_id`

## Common Issues & Fixes

### Issue: "Insufficient job volume" but rows exist
**Possible causes**:
1. Rows have wrong `organization_id` → Check DB directly
2. RLS policy blocking access → Check RLS policies
3. Wrong column name (`org_id` vs `organization_id`) → Check schema
4. Time window filter too restrictive → Check `time_range` parameter

**Fix**: Use `/api/debug/verify-org-scoping` to identify the issue

### Issue: Org name shows "test123@suren.com's Organization"
**Cause**: That's literally what's stored in `organizations.name`

**Fix**: Update the database:
```sql
UPDATE organizations 
SET name = 'Your Real Company Name' 
WHERE id = '<org-id>';
```

Or enforce validation at onboarding to prevent email-based names.

### Issue: Data leakage (Org A sees Org B's data)
**Possible causes**:
1. Query missing `.eq('organization_id', orgContext.orgId)`
2. RLS policy too permissive
3. Service role client bypassing RLS without org filtering

**Fix**: 
1. Use `/api/debug/verify-org-scoping` to detect leakage
2. Audit all queries for org scoping
3. Review RLS policies

## RLS Policy Recommendations

If using RLS (recommended), ensure policies like:

```sql
-- Jobs: Users can only see jobs from their organization
CREATE POLICY "Users can view jobs from their organization"
  ON jobs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Similar policies for incidents, report_runs, etc.
```

If using service role client (bypasses RLS), **MUST** enforce org scoping in code:
```typescript
.eq('organization_id', orgContext.orgId) // REQUIRED on every query
```

## Testing Two-Org Isolation

1. Create test user in Org A
2. Create test user in Org B
3. As Org A user:
   - Create 2 jobs (1 with risk_score >= 70)
   - Create 1 incident
   - Call `/api/debug/verify-org-scoping` → should show 2 jobs, 1 incident
4. As Org B user:
   - Create 5 jobs (all risk_score < 70)
   - Call `/api/debug/verify-org-scoping` → should show 5 jobs, 0 incidents
5. Generate PDFs for both → should show different metrics

