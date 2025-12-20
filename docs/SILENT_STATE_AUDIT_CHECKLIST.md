# Silent State Audit Checklist

**Purpose:** Ensure zero state changes occur without generating a Compliance Ledger entry.

**Rule:** "No UI change ships unless we can point to the Ledger entry it produces."

## State Changes That Must Generate Ledger Entries

### ✅ Verified (Already Logged)

- [x] **Job created** → `job.created`
- [x] **Job updated** → `job.updated`
- [x] **Job archived** → `job.archived`
- [x] **Job deleted** → `job.deleted`
- [x] **Risk score changed** → `job.risk_score_changed` (separate event)
- [x] **Job flagged** → `job.flagged_for_review`
- [x] **Job unflagged** → `job.unflagged`
- [x] **Mitigation completed** → `mitigation.completed`
- [x] **Mitigation updated** → `mitigation.updated`
- [x] **Document uploaded** → `document.uploaded`
- [x] **Photo uploaded** → `photo.uploaded`
- [x] **Sign-off created** → `job.signoff_created`
- [x] **Proof pack generated** → `proof_pack.{type}_generated`
- [x] **Role violation** → `auth.role_violation`
- [x] **Organization updated** → `account.organization_updated`
- [x] **Team invite sent** → `team.invite_sent`
- [x] **Team member removed** → `team.member_removed`
- [x] **Access revoked** → `team.member_removed`

### ⚠️ To Verify (Future States)

- [ ] **Sign-off rejected** → `job.signoff_rejected` (if rejection workflow exists)
- [ ] **Review reassigned** → `job.review_assigned` (if reassignment exists)
- [ ] **Document replaced** → `document.replaced` (if replacement exists)
- [ ] **Review note added** → `job.review_note_added` (if notes exist)
- [ ] **Review resolved** → `job.review_resolved` (if resolution workflow exists)

## Audit Process

Before shipping any UI change that modifies state:

1. **Identify the state change**
   - What data changes?
   - What database fields are updated?

2. **Check for Ledger entry**
   - Does `recordAuditLog()` get called?
   - Is the event name descriptive and namespaced?
   - Does it include actor, target, and metadata?

3. **Verify event mapping**
   - Is the event type in `lib/audit/eventMapper.ts`?
   - Does it have human-readable title, category, severity?
   - Does it include policy statement and exposure (if governance-related)?

4. **Test the flow**
   - Perform the action
   - Check Compliance Ledger
   - Verify event appears with correct metadata

## Red Flags

If any of these occur, **stop and fix**:

- ❌ State changes in database but no Ledger entry
- ❌ UI shows "updated" but Ledger shows nothing
- ❌ Event logged but not mapped (shows as "Unknown Event")
- ❌ Event logged but missing actor/target/metadata
- ❌ Multiple state changes but only one Ledger entry

## Enforcement

**Internal Rule:**
> "No UI change ships unless we can point to the Ledger entry it produces."

This keeps the product sharp forever.

## Current Status

**Last Audit:** January 2025  
**Status:** ✅ All verified state changes generate Ledger entries  
**Next Review:** When adding new state-changing features

