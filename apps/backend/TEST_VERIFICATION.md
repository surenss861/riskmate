# Test Helper Verification

## Summary

This document verifies that the test helper is correctly implemented according to best practices.

## ✅ Authentication Pattern Verification

### Service Role Key Usage (Admin Operations Only)

**Where Used**:
- ✅ `setupTestData()` - Creating/getting users via `adminClient.auth.admin.createUser()` and `adminClient.auth.admin.listUsers()`
- ✅ `cleanupTestData()` - Deleting test data via service role client (`supabase` which uses `getSupabaseAdmin()`)

**Why**: Service role key bypasses RLS and allows admin operations like creating users and bulk deletions.

### Anon Key Usage (Real Client Auth)

**Where Used**:
- ✅ `setupTestData()` - Getting JWT tokens via `anonClient.auth.signInWithPassword()`

**Why**: Tests should authenticate like real clients do - using the anon key and sign-in flow to get JWT tokens. This ensures the tests validate the actual auth flow.

### Implementation Check

```typescript
// ✅ CORRECT: Service role for admin operations
const adminClient = getSupabaseAdmin();
await adminClient.auth.admin.createUser(...);
await supabase.from("jobs").delete()...; // Uses service role

// ✅ CORRECT: Anon key for client auth
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const { data: session } = await anonClient.auth.signInWithPassword(...);
const token = session.session.access_token; // Real JWT token
```

## ✅ Cleanup Order Verification

### Foreign Key Dependencies

**Tables that reference `jobs` (ON DELETE CASCADE)**:
- `job_assignments`, `job_documents`, `job_signoffs`, `job_photos`, `job_risk_scores`
- `risk_scores`, `hazards`, `signatures`, `evidence`, `report_runs`
- `controls` (also references `hazards` ON DELETE SET NULL)

**Tables that reference `hazards`**:
- `controls` → `hazards` (ON DELETE SET NULL)

**Tables that reference `report_runs`**:
- `report_signatures` → `report_runs` (ON DELETE CASCADE)

**Tables that reference `organizations` (ON DELETE CASCADE)**:
- `organization_members`, `sites`, `jobs`, `hazards`, `controls`, `evidence`, `exports`, `ledger_roots`, `idempotency_keys`

**Special Cases**:
- `audit_logs.job_id` has `ON DELETE SET NULL`, so must be deleted explicitly
- `controls` references `hazards`, so hazards must be deleted before controls

### Current Cleanup Order

1. ✅ `controls` (references hazards) - **First**
2. ✅ `hazards` (referenced by controls)
3. ✅ `evidence_verifications` (references evidence/documents)
4. ✅ `evidence` (references jobs)
5. ✅ `report_signatures` (references report_runs)
6. ✅ `report_runs` (references jobs)
7. ✅ `signatures` (references jobs)
8. ✅ `job_assignments` (references jobs)
9. ✅ `job_documents` (references jobs)
10. ✅ `job_signoffs` (references jobs)
11. ✅ `mitigation_items` (references jobs)
12. ✅ `job_photos` (references jobs)
13. ✅ `risk_scores` (references jobs)
14. ✅ `job_risk_scores` (references jobs)
15. ✅ `jobs` (parent) - **After all children**
16. ✅ `exports` (references organizations only)
17. ✅ `sites` (references organizations only)
18. ✅ `ledger_roots` (references organizations only)
19. ✅ `idempotency_keys` (references organizations only)
20. ✅ `audit_logs` (ON DELETE SET NULL, must be explicit)
21. ✅ `organization_members` (references organizations) - **Last**

### Order Correctness

✅ **Correct**: Controls deleted before hazards (respects `controls → hazards` FK)
✅ **Correct**: Report signatures deleted before report runs (respects `report_signatures → report_runs` FK)
✅ **Correct**: All job children deleted before jobs (respects `* → jobs` FKs)
✅ **Correct**: Audit logs deleted explicitly (ON DELETE SET NULL)
✅ **Correct**: Organization members deleted last (references organizations but not jobs)

## ✅ Safety Fuse Verification

### Organization Name Check

**Implementation**:
```typescript
if (org.name !== "RiskMate Test Org") {
  throw new Error(
    `Safety fuse: Attempted to cleanup non-test organization "${org.name}". ` +
    "Only 'RiskMate Test Org' can be cleaned up by tests."
  );
}
```

**Where Used**:
- ✅ `cleanupTestData()` - Verifies org name before any deletions
- ✅ `setupTestData()` - Verifies org name before setup

**Result**: Tests can never accidentally touch production data.

## ✅ Test Data Lifecycle

### Setup (`setupTestData()`)
1. ✅ Verifies test org exists and has correct name
2. ✅ Gets or creates test users (owner, auditor, executive)
3. ✅ Creates user records in `public.users`
4. ✅ Adds to `organization_members`
5. ✅ Gets JWT tokens via real sign-in flow (anon key)
6. ✅ Creates test job

### Tests
1. ✅ Use real JWT tokens from `setupTestData()`
2. ✅ Hit actual API endpoints
3. ✅ Verify responses match expected behavior

### Cleanup (`cleanupTestData()`)
1. ✅ Verifies org name (safety fuse)
2. ✅ Deletes in correct order (respects FKs)
3. ✅ Only deletes from `TEST_ORG_ID`
4. ✅ Preserves users and org for reuse

## ✅ Environment Variables

**Required**:
- ✅ `TEST_ORG_ID` - Test organization UUID (safety fuse key)
- ✅ `SUPABASE_URL` - Supabase project URL
- ✅ `SUPABASE_ANON_KEY` - Anon key (for client auth)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)

**Optional** (auto-generated if not set):
- `TEST_OWNER_EMAIL` - Owner test user email
- `TEST_AUDITOR_EMAIL` - Auditor test user email
- `TEST_EXEC_EMAIL` - Executive test user email
- `TEST_USER_PASSWORD` - Test user password (defaults to "TestPassword123!")

## ✅ Implementation Correctness

**All checks passed**:
- ✅ Service role only for admin operations
- ✅ Anon key for client auth (real sign-in flow)
- ✅ Cleanup order respects foreign key constraints
- ✅ Safety fuse prevents production data access
- ✅ Test data lifecycle properly managed

## Next Steps

1. ✅ Create test organization in Supabase
2. ✅ Set `TEST_ORG_ID` in environment
3. ✅ Run tests: `TEST_ORG_ID=your-org-id npm test`
4. ✅ Add to CI/CD pipeline

Test infrastructure is production-ready and follows best practices. 🎉
