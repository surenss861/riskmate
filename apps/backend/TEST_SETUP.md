# Test Setup Guide

## Overview

Integration tests for read-only role enforcement use a dedicated test organization in your Supabase database. This approach is simpler than maintaining a separate test database and provides real-world testing against your actual schema.

## Prerequisites

1. **Test Organization**: Create a test organization in your Supabase database
   - Name: **"RiskMate Test Org"** (exact match required - safety fuse)
   - Note the `organization_id` (UUID)

2. **Environment Variables**:
   ```bash
   TEST_ORG_ID=your-test-org-uuid-here
   TEST_OWNER_EMAIL=test-owner@test.riskmate.dev  # Optional, auto-generated if not set
   TEST_AUDITOR_EMAIL=test-auditor@test.riskmate.dev  # Optional
   TEST_EXEC_EMAIL=test-exec@test.riskmate.dev  # Optional
   TEST_USER_PASSWORD=TestPassword123!  # Optional, defaults to this
   ```

## Setup Steps

### 1. Create Test Organization

In Supabase SQL Editor:

```sql
-- Create test organization
INSERT INTO organizations (id, name, created_at)
VALUES (
  gen_random_uuid(),  -- Or use a specific UUID you'll remember
  'RiskMate Test Org',
  NOW()
)
RETURNING id, name;
```

Save the `id` as `TEST_ORG_ID` in your `.env` file or CI secrets.

### 2. Test Users (Auto-Created)

The test helper will automatically create test users if they don't exist:
- **Owner**: Full write access
- **Auditor**: Read-only access (blocked from writes)
- **Executive**: Read-only access (blocked from writes)

Users are created in `auth.users` and linked in `public.users` and `organization_members`.

### 3. Running Tests

```bash
# Install test dependencies (if not already installed)
npm install --save-dev jest @types/jest supertest @types/supertest

# Run tests
TEST_ORG_ID=your-org-id npm test

# Or with all env vars
TEST_ORG_ID=your-org-id \
TEST_OWNER_EMAIL=test-owner@test.riskmate.dev \
TEST_AUDITOR_EMAIL=test-auditor@test.riskmate.dev \
TEST_EXEC_EMAIL=test-exec@test.riskmate.dev \
TEST_USER_PASSWORD=TestPassword123! \
npm test
```

## Test Helper Functions

### `setupTestData()`

Creates or retrieves:
- Test organization (verifies it exists and has correct name)
- Three test users (owner, auditor, executive)
- User records in `public.users`
- `organization_members` entries
- JWT tokens for all three users
- A test job for testing

**Returns**: `TestData` object with:
- `testOrgId`: Organization ID
- `ownerUserId`, `auditorUserId`, `executiveUserId`: User IDs
- `ownerToken`, `auditorToken`, `executiveToken`: JWT tokens
- `testJobId`: Test job ID
- `ownerEmail`, `auditorEmail`, `executiveEmail`: User emails

### `cleanupTestData(testOrgId)`

Deletes all test data for the test organization in the correct order (respecting foreign keys):
- Job-related child tables (documents, signoffs, mitigations, hazards, photos, risk scores)
- Jobs
- Audit logs
- Organization members

**Safety Fuse**: Only deletes data from organizations named "RiskMate Test Org"

## CI/CD Setup

### GitHub Actions Example

```yaml
name: Integration Tests

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      TEST_ORG_ID: ${{ secrets.TEST_ORG_ID }}
      TEST_OWNER_EMAIL: ${{ secrets.TEST_OWNER_EMAIL }}
      TEST_AUDITOR_EMAIL: ${{ secrets.TEST_AUDITOR_EMAIL }}
      TEST_EXEC_EMAIL: ${{ secrets.TEST_EXEC_EMAIL }}
      TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
```

### Required CI Secrets

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for admin operations)
- `SUPABASE_ANON_KEY`: Anon key (for user authentication)
- `TEST_ORG_ID`: UUID of test organization
- `TEST_OWNER_EMAIL`: Owner test user email (optional)
- `TEST_AUDITOR_EMAIL`: Auditor test user email (optional)
- `TEST_EXEC_EMAIL`: Executive test user email (optional)
- `TEST_USER_PASSWORD`: Test user password (optional)

## Test Data Cleanup

Tests automatically clean up test data after each run using `cleanupTestData()`. This:

1. Verifies the organization name is "RiskMate Test Org" (safety fuse)
2. Deletes data in correct order (respecting foreign keys)
3. Only deletes data from the test organization (never production data)

## Safety Features

1. **Organization Name Check**: Tests verify organization name before setup/cleanup
2. **Isolated Data**: All test data is scoped to `TEST_ORG_ID`
3. **No Production Impact**: Only the test organization is touched
4. **Cleanup Verification**: Cleanup verifies org name before deletion

## Troubleshooting

### "Test organization not found"
- Verify `TEST_ORG_ID` is set correctly
- Check that the organization exists in your Supabase database

### "Organization name mismatch"
- Verify the organization is named exactly "RiskMate Test Org"
- This is a safety fuse to prevent using production data

### "Failed to create user"
- Check that `SUPABASE_SERVICE_ROLE_KEY` has admin permissions
- Verify users don't already exist (test helper will reuse them)

### "Failed to get auth tokens"
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
- Verify test user passwords are correct

## Adding Test Dependencies

If you need to add Jest and Supertest:

```bash
npm install --save-dev jest @types/jest supertest @types/supertest ts-jest

# Create jest.config.js
```

Example `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
```

## Next Steps

1. Create test organization in Supabase
2. Set `TEST_ORG_ID` in your `.env` or CI secrets
3. Run tests: `TEST_ORG_ID=your-org-id npm test`
4. Add tests to CI/CD pipeline
