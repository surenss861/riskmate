# Integration Tests - Complete Setup

## Summary

All integration test infrastructure is now in place for read-only role enforcement testing. Tests use a dedicated test organization in your Supabase database and automatically handle setup and cleanup.

## What's Been Created

### 1. Test Helper (`src/__tests__/helpers/testData.ts`)

**Functions**:
- `setupTestData()`: Creates test org, users, and job; returns tokens and IDs
- `cleanupTestData(testOrgId)`: Cleans up test data in correct order

**Features**:
- ✅ Safety fuse: Verifies org name is "RiskMate Test Org" before any operations
- ✅ Auto-creates test users if they don't exist (reuses if they do)
- ✅ Gets real JWT tokens via Supabase Auth sign-in
- ✅ Respects foreign key constraints in cleanup order

### 2. Integration Tests (`src/__tests__/routes/read-only-enforcement.test.ts`)

**Test Cases**:
1. ✅ Auditor blocked from PATCH/POST/DELETE → 403
2. ✅ Executive blocked from write operations → 403
3. ✅ Auditor allowed for proof-pack generation → 200
4. ✅ Owner allowed for write operations → 200
5. ✅ Audit log verification for role violations

**Coverage**:
- Read-only role enforcement
- Write operation blocking
- Proof-pack exception (read-only output)
- Audit trail logging

### 3. App Export (`src/index.ts`)

**Changes**:
- Exported `app` as default for testing
- Skip server startup if `NODE_ENV=test`

This allows tests to import the app directly without starting the server.

### 4. Documentation (`TEST_SETUP.md`)

Complete setup guide including:
- Test organization creation
- Environment variables
- CI/CD setup
- Troubleshooting

## Setup Instructions

### 1. Create Test Organization

In Supabase SQL Editor:

```sql
INSERT INTO organizations (id, name, created_at)
VALUES (
  gen_random_uuid(),
  'RiskMate Test Org',
  NOW()
)
RETURNING id, name;
```

Save the `id` as `TEST_ORG_ID`.

### 2. Set Environment Variables

Create `.env.test` or set in CI:

```bash
TEST_ORG_ID=your-test-org-uuid-here
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Optional (auto-generated if not set)
TEST_OWNER_EMAIL=test-owner@test.riskmate.dev
TEST_AUDITOR_EMAIL=test-auditor@test.riskmate.dev
TEST_EXEC_EMAIL=test-exec@test.riskmate.dev
TEST_USER_PASSWORD=TestPassword123!
```

### 3. Install Test Dependencies (if needed)

```bash
cd apps/backend
npm install --save-dev jest @types/jest supertest @types/supertest ts-jest
```

### 4. Add Test Script to `package.json`

```json
{
  "scripts": {
    "test": "NODE_ENV=test jest --testPathPattern=__tests__",
    "test:watch": "NODE_ENV=test jest --watch --testPathPattern=__tests__"
  }
}
```

### 5. Run Tests

```bash
TEST_ORG_ID=your-org-id npm test
```

## CI/CD Setup

Add to your GitHub Actions workflow:

```yaml
- name: Run Integration Tests
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    TEST_ORG_ID: ${{ secrets.TEST_ORG_ID }}
  run: npm test
```

## Safety Features

1. **Organization Name Verification**: Tests verify org name before setup/cleanup
2. **Isolated Data**: All operations scoped to `TEST_ORG_ID`
3. **Cleanup Order**: Respects foreign key constraints
4. **No Production Impact**: Only test organization is touched

## Test Data Flow

1. **Setup** (`beforeAll`):
   - Verify test org exists and has correct name
   - Get or create test users (owner, auditor, executive)
   - Create user records in `public.users`
   - Add to `organization_members`
   - Get JWT tokens via sign-in
   - Create test job

2. **Tests**:
   - Use real JWT tokens to hit API endpoints
   - Verify 403 responses for blocked operations
   - Verify 200 responses for allowed operations
   - Check audit logs for violations

3. **Cleanup** (`afterAll`):
   - Verify org name (safety fuse)
   - Delete job-related data (documents, signoffs, mitigations, hazards, photos, risk scores)
   - Delete jobs
   - Delete audit logs
   - Delete organization members
   - **Note**: Users and org are kept for reuse across runs

## Cleanup Order

Deletes in this order (respects foreign keys):

1. `job_documents` (child of jobs)
2. `job_signoffs` (child of jobs)
3. `mitigation_items` (child of jobs)
4. `hazards` (child of jobs)
5. `job_photos` (child of jobs)
6. `job_risk_scores` (child of jobs)
7. `jobs` (parent)
8. `audit_logs` (referenced by jobs)
9. `organization_members` (child of org and users)

**Not deleted**:
- `users` (in `auth.users` and `public.users`) - reused across runs
- `organizations` - kept for consistency

## Files Created

- `src/__tests__/helpers/testData.ts` - Test data setup/cleanup
- `src/__tests__/routes/read-only-enforcement.test.ts` - Integration tests
- `TEST_SETUP.md` - Setup guide
- `INTEGRATION_TESTS_COMPLETE.md` - This file

## Files Modified

- `src/index.ts` - Exported app for testing, skip server in test mode
- `src/lib/supabaseClient.ts` - Exported `getSupabaseAdmin` for test helpers

## Next Steps

1. ✅ Test infrastructure created
2. ✅ Test helpers implemented
3. ✅ Integration tests written
4. ⏳ Create test organization in Supabase
5. ⏳ Set `TEST_ORG_ID` in environment
6. ⏳ Install test dependencies (Jest, Supertest)
7. ⏳ Add test script to `package.json`
8. ⏳ Run tests locally: `TEST_ORG_ID=your-org-id npm test`
9. ⏳ Add tests to CI/CD pipeline

## Verification

After setup, tests should:
- ✅ Create test data successfully
- ✅ Block auditors from write operations
- ✅ Block executives from write operations
- ✅ Allow auditors to generate proof-packs
- ✅ Allow owners to perform write operations
- ✅ Log role violations to audit trail
- ✅ Clean up test data after run

All tests use real Supabase Auth tokens and hit actual API endpoints, providing high confidence in read-only enforcement.
