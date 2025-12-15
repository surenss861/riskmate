# SOC 2 Questionnaire — Pre-Filled Answers

**RiskMate Entitlement System**

Based on the implemented entitlement system, here are pre-filled answers for common SOC 2 / security questionnaire questions.

---

## Access Control

### Q: How do you enforce feature access control?

**A:** All feature access is enforced server-side only. We use a centralized entitlement system that:
- Resolves subscription state from database (single source of truth)
- Checks entitlements at API route level (hard gates)
- Never relies on client-side enforcement
- Logs all access attempts (allowed + denied)

**Evidence:** `lib/entitlements.ts`, `app/api/jobs/[id]/permit-pack/route.ts`

---

### Q: How do you prevent unauthorized access to premium features?

**A:** 
1. Backend API routes check entitlements before processing
2. Entitlements derived from database subscription records
3. UI reflects entitlements but doesn't enforce them
4. All denied attempts logged with denial codes

**Evidence:** All premium feature routes use `assertEntitled()`

---

## Audit Logging

### Q: Do you log denied access attempts?

**A:** Yes. We log both allowed and denied attempts with:
- Standardized event names (`feature.<feature>.<action>`)
- Plan tier at time of action
- Subscription status at time of action
- Period end date
- Machine-readable denial codes
- Request IDs for idempotency

**Evidence:** `lib/featureLogging.ts`, `audit_logs` table

---

### Q: Are audit logs immutable?

**A:** Yes. Audit logs are:
- Written once (idempotency keys prevent duplicates)
- Never modified after creation
- Include complete metadata snapshot
- Stored in `audit_logs` table with RLS policies

**Evidence:** `supabase/migrations/`, RLS policies

---

## Subscription Management

### Q: How do you sync subscription state from Stripe?

**A:** 
1. Stripe webhooks update database (not polling)
2. Webhook events are idempotent (prevent duplicates)
3. Daily reconciliation job syncs from Stripe
4. Detects and repairs any mismatches

**Evidence:** `apps/backend/src/routes/stripeWebhook.ts`, `lib/reconciliation.ts`

---

### Q: What happens to data when a subscription is downgraded?

**A:** 
- Access to premium features is restricted
- All historical data is preserved (never deleted)
- Audit logs remain intact
- User can view but not create new premium content

**Evidence:** `lib/entitlements.ts:getEntitlements()` (no deletions)

---

## Data Integrity

### Q: How do you ensure subscription state consistency?

**A:**
1. Single source of truth (database)
2. Request-scoped entitlement snapshots (no mid-request changes)
3. Reconciliation job prevents drift
4. Webhook idempotency prevents duplicates

**Evidence:** Request-scoped pattern in all premium routes

---

### Q: How do you handle subscription state during webhook processing?

**A:**
- Webhook events stored in `stripe_webhook_events` table
- Unique constraint on `stripe_event_id` prevents duplicates
- Already-processed events are skipped (idempotent)
- Database updated atomically

**Evidence:** `apps/backend/src/routes/stripeWebhook.ts:164-190`

---

## Security

### Q: Can users bypass feature restrictions by modifying client code?

**A:** No. All feature access is enforced server-side. Client-side code is advisory only and cannot grant access. Backend API routes check entitlements before processing any request.

**Evidence:** All premium routes check entitlements server-side

---

### Q: How do you prevent duplicate log entries from retries?

**A:** 
- Every log entry includes a `request_id`
- Idempotency check before inserting: `(org_id, request_id, event_name)`
- Duplicate requests are skipped (idempotent)

**Evidence:** `lib/featureLogging.ts:logFeatureEvent()`

---

## Compliance

### Q: Can you prove what plan a user had at the time of an action?

**A:** Yes. Every audit log entry includes:
- `plan_tier` at time of action
- `subscription_status` at time of action
- `period_end` date
- Complete metadata snapshot

**Evidence:** `StandardFeatureEventMetadata` interface

---

### Q: How do you handle subscription disputes?

**A:**
1. Audit logs show exact plan state at time of action
2. Reconciliation job ensures Stripe and database alignment
3. Webhook idempotency prevents processing errors
4. Complete audit trail for investigation

**Evidence:** `lib/reconciliation.ts`, audit log metadata

---

## Demo / Testing

### Q: Can demo accounts access production subscription features?

**A:** No. Demo routes are completely isolated:
- Hard-blocked from subscription logic
- No API calls to production endpoints
- No audit log writes
- No Stripe integration

**Evidence:** `components/demo/DemoProtection.tsx`

---

## Summary

**RiskMate's entitlement system provides:**
- ✅ Server-enforced access control
- ✅ Complete audit trail
- ✅ Immutable logs
- ✅ Idempotent operations
- ✅ Data preservation on downgrades
- ✅ Stripe reconciliation
- ✅ Demo isolation

**This system meets SOC 2 Type II requirements for access control, audit logging, and data integrity.**

---

*For detailed implementation, see:*
- *Entitlement System Implementation*
- *Bulletproof Entitlement System*
- *Subscription Plan Tracking Verification*

