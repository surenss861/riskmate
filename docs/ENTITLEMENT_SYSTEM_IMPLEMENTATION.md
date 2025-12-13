# Enterprise Entitlement System Implementation

**Status:** ✅ Implemented

This document describes the centralized entitlement system that ensures consistent, auditable feature access control across RiskMate.

---

## Architecture

### Core Components

1. **`lib/entitlements.ts`** - Single source of truth for feature access
2. **`lib/featureLogging.ts`** - Comprehensive audit logging
3. **Route handlers** - Use entitlement system for all premium features

---

## 1. Entitlement System (`lib/entitlements.ts`)

### Functions

#### `getOrgSubscription(organizationId)`
- Fetches subscription from database (source of truth)
- Returns `OrgSubscription` or `null`
- Never infers from UI state

#### `getEntitlements(subscription)`
- Derives feature access from subscription
- Handles all status cases:
  - `active` / `trialing` = full access
  - `past_due` = hard block (no grace period)
  - `canceled` = check `current_period_end`
  - `none` = starter defaults

#### `assertEntitled(entitlements, feature)`
- Throws `EntitlementError` if feature not available
- Use in route handlers for enforcement

#### `hasEntitlement(entitlements, feature)`
- Returns boolean (no throw)
- Useful for UI checks

#### `getOrgEntitlements(organizationId)`
- Convenience function
- Combines `getOrgSubscription` + `getEntitlements`

### Entitlements Object

```typescript
{
  permit_packs: boolean
  version_history: boolean
  evidence_verification: boolean // All plans
  job_assignment: boolean // All plans
  jobs_monthly_limit: number | null // null = unlimited
  seats_limit: number | null // null = unlimited
  tier: PlanTier
  status: SubscriptionStatus
  period_end: string | null
}
```

---

## 2. Feature Logging (`lib/featureLogging.ts`)

### Functions

#### `logFeatureEvent(params)`
- Writes to `audit_logs` table
- Logs both **allowed** and **denied** attempts
- Immutable audit trail for compliance

#### `logUsage(params)`
- Writes to `usage_logs` table
- Only logs successful usage (not denied)
- For metering/analytics/billing

#### `logFeatureUsage(params)`
- Convenience function
- Logs to both `audit_logs` and `usage_logs`
- Handles allowed/denied logic automatically

### Logged Metadata

Every feature event includes:
- `plan_tier` - Plan at time of action
- `subscription_status` - Status at time of action
- `period_end` - Period end date
- `reason` - For denied attempts
- `request_id` - Optional request tracking
- Feature-specific metadata (job_id, worker_id, etc.)

---

## 3. Route Handler Pattern

### Standard Pattern

```typescript
export async function POST(request: NextRequest, { params }) {
  const { organization_id, user_id } = await getOrganizationContext()
  
  try {
    // Get entitlements
    const entitlements = await getOrgEntitlements(organization_id)
    
    // Assert entitlement
    try {
      assertEntitled(entitlements, 'permit_packs')
    } catch (err) {
      if (err instanceof EntitlementError) {
        // Log denied attempt
        await logFeatureUsage({
          feature: 'permit_pack',
          action: 'denied',
          allowed: false,
          organizationId: organization_id,
          actorId: user_id,
          metadata: {
            plan_tier: entitlements.tier,
            subscription_status: entitlements.status,
            period_end: entitlements.period_end,
            reason: err.message,
          },
          logUsage: false,
        })
        
        return NextResponse.json(
          { error: err.message, code: 'FEATURE_RESTRICTED' },
          { status: 403 }
        )
      }
      throw err
    }
    
    // Perform action
    const result = await performAction()
    
    // Log successful usage
    await logFeatureUsage({
      feature: 'permit_pack',
      action: 'generated',
      allowed: true,
      organizationId: organization_id,
      actorId: user_id,
      metadata: {
        plan_tier: entitlements.tier,
        subscription_status: entitlements.status,
        period_end: entitlements.period_end,
        // Feature-specific metadata
      },
      logUsage: true,
    })
    
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    // Handle errors
  }
}
```

---

## 4. Implemented Routes

### ✅ Permit Pack Generation
**Route:** `app/api/jobs/[id]/permit-pack/route.ts`
- Uses `assertEntitled('permit_packs')`
- Logs allowed and denied attempts
- Includes plan snapshot in logs

### ✅ Version History / Audit Log
**Route:** `app/api/jobs/[id]/audit/route.ts`
- Uses `assertEntitled('version_history')`
- Logs access attempts
- Returns audit log entries

### ✅ Job Creation
**Route:** `app/api/jobs/route.ts`
- Checks `jobs_monthly_limit` from entitlements
- Logs job creation with plan metadata
- Enforces limits consistently

---

## 5. Status Handling

### Active / Trialing
- ✅ Full access to entitled features
- ✅ Limits enforced

### Past Due
- ❌ Hard block (no grace period)
- ✅ Data preserved
- ✅ Clear error messages

### Canceled
- ✅ Access until `current_period_end`
- ❌ Blocked after period end
- ✅ Data preserved

### None (No Subscription)
- ✅ Defaults to starter plan
- ✅ Starter limits enforced

---

## 6. Audit Logging

### What Gets Logged

#### Allowed Attempts
- Feature name
- Action (generated, accessed, created, etc.)
- Plan tier at time of action
- Subscription status at time of action
- Period end date
- Feature-specific metadata

#### Denied Attempts
- Feature name
- Action: `denied`
- Plan tier
- Subscription status
- Reason for denial
- **Not logged to usage_logs** (only audit_logs)

### Audit Log Structure

```typescript
{
  organization_id: string
  actor_id: string
  event_name: 'permit_pack.generated' | 'permit_pack.denied'
  target_type: 'job' | 'feature'
  target_id: string
  metadata: {
    plan_tier: 'business'
    subscription_status: 'active'
    period_end: '2024-02-01T00:00:00Z'
    allowed: true
    feature: 'permit_pack'
    action: 'generated'
    timestamp: '2024-01-15T10:30:00Z'
    // Feature-specific fields
  }
}
```

---

## 7. Testing

### Test File: `__tests__/entitlements.test.ts`

Tests cover:
- ✅ Default entitlements (no subscription)
- ✅ Business plan active access
- ✅ Business plan trialing access
- ✅ Past due blocking
- ✅ Canceled subscription period logic
- ✅ Pro plan limits
- ✅ `assertEntitled` error handling

### Integration Tests Needed

For each premium feature route:
1. Starter + active → 403 with FEATURE_RESTRICTED
2. Business + active → 200 success
3. Business + past_due → 403 (hard block)
4. No subscription → 403 (defaults to starter)
5. Verify audit log written on allow ✅
6. Verify audit log written on deny ✅
7. Verify usage log written only on allow ✅

---

## 8. Benefits

### Consistency
- ✅ Single source of truth
- ✅ No copy/paste tier checks
- ✅ Deterministic behavior

### Auditability
- ✅ Every attempt logged (allowed + denied)
- ✅ Plan snapshot at time of action
- ✅ Compliance-ready audit trail

### Maintainability
- ✅ Centralized logic
- ✅ Easy to add new features
- ✅ Clear error messages

### Enterprise Credibility
- ✅ Inspector-safe
- ✅ Legal-defensible
- ✅ Auditor-verifiable

---

## 9. Future Enhancements

### Option 1: Entitlements Table
Store explicit feature flags:
```sql
org_entitlements(feature, enabled, source, updated_at)
```
- Pros: Custom deals, enterprise overrides
- Cons: More complexity

### Option 2: Policy Engine
Central `can(actor, action, resource)` function:
- Checks role + plan + org rules + job status
- Pros: Extremely clean at scale
- Cons: Upfront work

---

## 10. Migration Checklist

- ✅ Created `lib/entitlements.ts`
- ✅ Created `lib/featureLogging.ts`
- ✅ Refactored permit pack route
- ✅ Created audit log route
- ✅ Refactored job creation route
- ⚠️ Add tests for all routes
- ⚠️ Update other premium routes (if any)
- ⚠️ Add UI hook `useEntitlements()`

---

## Conclusion

The entitlement system provides:
- **Single source of truth** for feature access
- **Comprehensive audit logging** for compliance
- **Consistent enforcement** across all routes
- **Enterprise-grade** reliability and auditability

This system ensures RiskMate meets enterprise standards for subscription tracking, feature gating, and audit compliance.

