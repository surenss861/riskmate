# Multi-Tenant Data Isolation Architecture

RiskMate implements **true multi-tenant data isolation** to ensure that every organization's data is completely isolated from all other organizations. This document explains how the isolation is enforced at multiple layers.

## Architecture Overview

Data isolation is enforced at **three layers**:

1. **Database Layer (RLS)**: Row Level Security policies in Supabase
2. **Application Layer (API Routes)**: Explicit organization_id filtering
3. **Storage Layer**: Bucket policies scoped to organization_id

## Layer 1: Row Level Security (RLS)

### How It Works

Every table has RLS enabled with policies that automatically filter by `organization_id`:

```sql
-- Example: Jobs table policy
CREATE POLICY "Users can view jobs in their organization"
  ON jobs FOR SELECT
  USING (organization_id = get_user_organization_id());
```

The `get_user_organization_id()` function extracts the organization_id from the authenticated user's record.

### Tables with RLS Enabled

- ✅ `organizations`
- ✅ `users`
- ✅ `jobs`
- ✅ `job_risk_scores`
- ✅ `mitigation_items`
- ✅ `documents`
- ✅ `risk_snapshot_reports`
- ✅ `subscriptions`
- ✅ `org_subscriptions`
- ✅ `notifications`
- ✅ `sub_attestations`
- ✅ `analytics_events`
- ✅ `legal_acceptances`
- ✅ `audit_logs`
- ✅ `organization_invites`
- ✅ `report_snapshots`
- ✅ `device_tokens`
- ✅ `refresh_tokens`

### What This Means

Even if a user tries to query:
```sql
SELECT * FROM jobs WHERE id = 'some-other-org-job-id';
```

Supabase will automatically add:
```sql
AND organization_id = get_user_organization_id()
```

**Result**: They can only see jobs from their own organization.

## Layer 2: Application Layer (API Routes)

### Organization Guard Utility

All API routes use the `getOrganizationContext()` utility:

```typescript
import { getOrganizationContext, verifyJobOwnership } from '@/lib/utils/organizationGuard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Get organization context (throws if unauthorized)
  const { organization_id } = await getOrganizationContext()
  
  // Verify resource ownership
  await verifyJobOwnership(jobId, organization_id)
  
  // All queries explicitly filter by organization_id
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('organization_id', organization_id) // Explicit filter
    .single()
}
```

### Defense-in-Depth

Even though RLS protects at the database level, we also:

1. **Explicitly filter** all queries by `organization_id`
2. **Verify ownership** before operations (e.g., `verifyJobOwnership()`)
3. **Never trust** user-provided IDs without verification

### Example: Job Access

```typescript
// ❌ BAD - No organization check
const { data } = await supabase
  .from('jobs')
  .select('*')
  .eq('id', jobId)
  .single()

// ✅ GOOD - Explicit organization check
const { organization_id } = await getOrganizationContext()
const { data } = await supabase
  .from('jobs')
  .select('*')
  .eq('id', jobId)
  .eq('organization_id', organization_id) // Explicit filter
  .single()
```

## Layer 3: Storage Bucket Policies

### Document Storage

All files are stored with organization_id in the path:

```
documents/{organization_id}/{job_id}/{filename}
```

Storage policies enforce:

```sql
CREATE POLICY "Users can view documents in their organization"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = get_user_organization_id()::text
  );
```

### What This Means

Even if someone tries to access:
```
documents/other-org-id/job-id/file.jpg
```

Supabase will deny access because the organization_id doesn't match.

## Security Guarantees

### ✅ What's Protected

1. **Data Access**: Users can only read/write their organization's data
2. **ID Guessing**: Even if someone guesses a UUID, RLS blocks access
3. **API Manipulation**: Backend always verifies organization_id
4. **Storage Access**: Bucket policies prevent cross-org file access
5. **Direct Database Access**: RLS prevents even direct SQL queries

### ✅ Attack Vectors Blocked

- **ID Enumeration**: Can't guess IDs to access other orgs' data
- **API Parameter Manipulation**: Backend verifies ownership
- **Direct Supabase Client Calls**: RLS enforces isolation
- **Storage URL Guessing**: Bucket policies block access
- **SQL Injection**: RLS policies are applied regardless

## Testing Isolation

To verify isolation works:

1. **Create Org A** with user A
2. **Create Org B** with user B
3. **Create a job in Org A**
4. **Try to access that job as User B**:
   - Via API: Should return 404
   - Via direct Supabase query: Should return empty (RLS blocks)
   - Via storage URL: Should be denied

## Best Practices

### ✅ DO

- Always use `getOrganizationContext()` in API routes
- Always filter queries by `organization_id`
- Always verify resource ownership before operations
- Use the organization guard utilities
- Test isolation between organizations

### ❌ DON'T

- Never query without `organization_id` filter
- Never trust user-provided IDs without verification
- Never bypass the organization guard utilities
- Never expose internal database IDs in URLs (use UUIDs)

## Migration Status

All tables have RLS enabled. See:
- `supabase/migrations/20240101000001_row_level_security.sql` (initial policies)
- `supabase/migrations/20251127000000_add_missing_rls_policies.sql` (additional tables)

## Compliance

This architecture ensures:

- ✅ **SOC-2 Compliance**: Data isolation is enforced at multiple layers
- ✅ **GDPR Compliance**: Organizations can't access each other's data
- ✅ **Enterprise-Grade**: Production-ready multi-tenant architecture
- ✅ **Audit-Ready**: All access is logged and traceable

## Questions?

If you find any queries that don't filter by `organization_id`, or any tables missing RLS policies, please report them immediately. Data isolation is critical for a compliance-focused SaaS like RiskMate.

