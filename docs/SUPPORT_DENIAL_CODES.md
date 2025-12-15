# Support Guide — Denial Codes

**Quick Reference for Troubleshooting Feature Access Issues**

---

## Denial Code Taxonomy

### `PLAN_TIER_INSUFFICIENT`
**Meaning:** Feature requires a higher plan tier

**Example:** User on Starter/Pro tries to generate Permit Pack (Business-only)

**Resolution:**
- Explain feature is Business plan only
- Offer upgrade path
- Show feature comparison

**Common Features:**
- Permit Packs (Business)
- Version History (Business)

---

### `SUBSCRIPTION_PAST_DUE`
**Meaning:** Subscription payment failed, access blocked

**Example:** Business plan user with past_due status tries to use premium features

**Resolution:**
- Direct to billing portal
- Explain payment issue
- Access restored when payment succeeds

**Note:** Hard block (no grace period) for compliance integrity

---

### `SUBSCRIPTION_CANCELED_PERIOD_ENDED`
**Meaning:** Subscription canceled and billing period has ended

**Example:** Business plan canceled, period_end date passed

**Resolution:**
- Explain subscription ended
- Offer to reactivate
- Historical data preserved (not deleted)

**Note:** Access allowed until period_end, then blocked

---

### `MONTHLY_LIMIT_REACHED`
**Meaning:** Monthly usage limit exceeded

**Example:** Starter plan user tries to create 11th job (limit: 10/month)

**Resolution:**
- Explain current limit
- Show usage count
- Offer upgrade to Pro (unlimited)

**Common Limits:**
- Jobs per month (Starter: 10)
- Seats (Pro: 5, Business: unlimited)

---

### `SEAT_LIMIT_REACHED`
**Meaning:** Team member limit exceeded

**Example:** Pro plan user tries to invite 6th team member (limit: 5)

**Resolution:**
- Explain current seat limit
- Show current team size
- Offer upgrade to Business (unlimited)

---

### `ROLE_FORBIDDEN`
**Meaning:** User role doesn't have permission

**Example:** Member tries to assign workers (owner/admin only)

**Resolution:**
- Explain role-based access
- Suggest contacting owner/admin
- Show permission matrix

**Common Restrictions:**
- Job Assignment (owner/admin)
- Evidence Verification (owner/admin)

---

### `RESOURCE_NOT_FOUND`
**Meaning:** Requested resource doesn't exist or user doesn't have access

**Example:** User tries to access job from different organization

**Resolution:**
- Verify resource exists
- Check organization membership
- Verify permissions

---

### `UNKNOWN_ERROR`
**Meaning:** Unexpected error occurred

**Example:** System error during entitlement check

**Resolution:**
- Check audit logs for details
- Verify subscription state
- Escalate if persistent

---

## How to Look Up Denial Details

### From Audit Logs

```sql
SELECT 
  event_name,
  metadata->>'denial_code' as denial_code,
  metadata->>'reason' as reason,
  metadata->>'plan_tier' as plan_tier,
  metadata->>'subscription_status' as status,
  created_at
FROM audit_logs
WHERE 
  organization_id = 'org-123'
  AND event_name LIKE 'feature.%denied'
ORDER BY created_at DESC;
```

### From API Response

```json
{
  "error": "Feature requires Business plan",
  "code": "FEATURE_RESTRICTED",
  "denial_code": "PLAN_TIER_INSUFFICIENT"
}
```

---

## Support Workflow

1. **Identify Denial Code**
   - From user report or audit logs
   - Check API response if available

2. **Verify Subscription State**
   - Check current plan tier
   - Check subscription status
   - Check period_end date

3. **Explain to User**
   - Use denial code meaning
   - Provide resolution path
   - Offer upgrade if applicable

4. **Log Resolution**
   - Document in support system
   - Reference audit log entry
   - Track resolution time

---

## Common Scenarios

### "I can't generate Permit Packs"
- **Likely Code:** `PLAN_TIER_INSUFFICIENT`
- **Check:** Current plan tier
- **Resolution:** Upgrade to Business plan

### "I was able to do this yesterday"
- **Likely Code:** `SUBSCRIPTION_PAST_DUE` or `SUBSCRIPTION_CANCELED_PERIOD_ENDED`
- **Check:** Subscription status, period_end
- **Resolution:** Payment issue or subscription ended

### "I can't create more jobs"
- **Likely Code:** `MONTHLY_LIMIT_REACHED`
- **Check:** Jobs created this month, plan tier
- **Resolution:** Upgrade to Pro (unlimited)

### "I can't assign workers"
- **Likely Code:** `ROLE_FORBIDDEN`
- **Check:** User role (member vs owner/admin)
- **Resolution:** Contact owner/admin to assign

---

## Sales Intelligence

**Use denial codes for:**
- Feature demand analysis
- Upgrade opportunity identification
- Plan limit optimization
- User experience improvements

**Example Query:**
```sql
-- How many users tried Permit Packs on Pro plan?
SELECT COUNT(*)
FROM audit_logs
WHERE 
  event_name = 'feature.permit_packs.denied'
  AND metadata->>'denial_code' = 'PLAN_TIER_INSUFFICIENT'
  AND metadata->>'plan_tier' = 'pro';
```

---

**This system enables data-driven support and sales intelligence.**

