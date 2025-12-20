# Executive Immutability Validation Checklist

**Purpose:** Verify that executives are technically incapable of mutating governance records at the database level.

**Date:** 2025-01-20  
**Status:** Validation Required

---

## Validation Steps

### Prerequisites
1. Create or identify a test user with `role = 'executive'`
2. Ensure the user has access to an organization with test data
3. Have access to Supabase dashboard or SQL client to verify audit logs

### Test Cases

#### 1. Job Update Attempt
**Action:** As executive, attempt to update a job (e.g., change status, risk score, or any field)

**Expected Result:**
- ✅ Request blocked at database level (RLS policy prevents UPDATE)
- ✅ API returns `403 Forbidden` with `AUTH_ROLE_READ_ONLY` error code
- ✅ Audit log entry created: `auth.role_violation` with event details

**Verification:**
```sql
-- Check audit logs for violation
SELECT * FROM audit_logs 
WHERE event_name = 'auth.role_violation' 
  AND actor_role = 'executive'
  AND action LIKE '%job%update%'
ORDER BY created_at DESC
LIMIT 1;
```

---

#### 2. Job Delete Attempt
**Action:** As executive, attempt to delete a job

**Expected Result:**
- ✅ Request blocked at database level (RLS policy prevents DELETE)
- ✅ API returns `403 Forbidden` with `AUTH_ROLE_READ_ONLY` error code
- ✅ Audit log entry created: `auth.role_violation`

**Verification:**
```sql
-- Check audit logs for violation
SELECT * FROM audit_logs 
WHERE event_name = 'auth.role_violation' 
  AND actor_role = 'executive'
  AND action LIKE '%job%delete%'
ORDER BY created_at DESC
LIMIT 1;
```

---

#### 3. Document Upload Attempt
**Action:** As executive, attempt to upload a document to a job

**Expected Result:**
- ✅ Request blocked at database level (RLS policy prevents INSERT on documents)
- ✅ API returns `403 Forbidden` with `AUTH_ROLE_READ_ONLY` error code
- ✅ Audit log entry created: `auth.role_violation`

**Verification:**
```sql
-- Check audit logs for violation
SELECT * FROM audit_logs 
WHERE event_name = 'auth.role_violation' 
  AND actor_role = 'executive'
  AND action LIKE '%document%'
ORDER BY created_at DESC
LIMIT 1;
```

---

#### 4. Sign-off Creation Attempt
**Action:** As executive, attempt to create a sign-off for a job

**Expected Result:**
- ✅ Request blocked at database level (RLS policy prevents INSERT on job_signoffs)
- ✅ API returns `403 Forbidden` with `AUTH_ROLE_READ_ONLY` error code
- ✅ Audit log entry created: `auth.role_violation`

**Verification:**
```sql
-- Check audit logs for violation
SELECT * FROM audit_logs 
WHERE event_name = 'auth.role_violation' 
  AND actor_role = 'executive'
  AND action LIKE '%signoff%'
ORDER BY created_at DESC
LIMIT 1;
```

---

#### 5. Mitigation Update Attempt
**Action:** As executive, attempt to update a mitigation item (e.g., mark as completed)

**Expected Result:**
- ✅ Request blocked at database level (RLS policy prevents UPDATE on mitigation_items)
- ✅ API returns `403 Forbidden` with `AUTH_ROLE_READ_ONLY` error code
- ✅ Audit log entry created: `auth.role_violation`

**Verification:**
```sql
-- Check audit logs for violation
SELECT * FROM audit_logs 
WHERE event_name = 'auth.role_violation' 
  AND actor_role = 'executive'
  AND action LIKE '%mitigation%'
ORDER BY created_at DESC
LIMIT 1;
```

---

#### 6. Site Update Attempt
**Action:** As executive, attempt to update a site (e.g., change name or address)

**Expected Result:**
- ✅ Request blocked at database level (RLS policy prevents UPDATE on sites)
- ✅ API returns `403 Forbidden` with `AUTH_ROLE_READ_ONLY` error code
- ✅ Audit log entry created: `auth.role_violation`

**Verification:**
```sql
-- Check audit logs for violation
SELECT * FROM audit_logs 
WHERE event_name = 'auth.role_violation' 
  AND actor_role = 'executive'
  AND action LIKE '%site%'
ORDER BY created_at DESC
LIMIT 1;
```

---

#### 7. Audit Log Insert Attempt (Direct DB Access)
**Action:** As executive, attempt to directly insert into audit_logs table (if direct DB access exists)

**Expected Result:**
- ✅ Request blocked at database level (RLS policy prevents INSERT on audit_logs for executives)
- ✅ Error returned by database

**Verification:**
```sql
-- Attempt direct insert (should fail)
-- This test requires direct database access as the executive user
-- Should return: "new row violates row-level security policy"
```

---

## Validation Results Template

| Test Case | Status | Notes | Audit Log Verified |
|-----------|--------|-------|-------------------|
| Job Update | ⬜ | | ⬜ |
| Job Delete | ⬜ | | ⬜ |
| Document Upload | ⬜ | | ⬜ |
| Sign-off Creation | ⬜ | | ⬜ |
| Mitigation Update | ⬜ | | ⬜ |
| Site Update | ⬜ | | ⬜ |
| Audit Log Insert | ⬜ | | ⬜ |

---

## Success Criteria

✅ All mutation attempts are blocked at the database level  
✅ All blocked attempts generate `auth.role_violation` audit log entries  
✅ All API responses return appropriate error codes (`AUTH_ROLE_READ_ONLY`)  
✅ No mutations succeed, even if API layer is bypassed  

---

## Post-Validation

Once validated, update this document:
- **Validation Date:** [Date]
- **Validated By:** [Name]
- **Status:** ✅ Validated

This validation proves the claim: "Executives are technically incapable of mutating governance records. Oversight and authority are intentionally separated."

