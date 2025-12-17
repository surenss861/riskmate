# RiskMate Governance Model

**Version:** 1.0.0  
**Last Updated:** 2025-01-17  
**Status:** Active

---

## Overview

RiskMate implements a **capability-constrained risk system** where authority is intentional, accountability is provable, and history cannot be rewritten. This document defines the operational capabilities of each role and serves as:

- **Developer guardrail**: Server-side enforcement reference
- **Sales artifact**: Enterprise buyer explanation
- **Audit documentation**: Legal/compliance evidence

**Critical Principle:** Capabilities are **server-enforced at the API layer**, not UI permissions. If a role cannot perform an action, the API returns an explicit error code. This makes privilege escalation impossible and audit trails unambiguous.

---

## Role Capability Matrix

| Capability | Owner | Admin | Safety Lead | Executive | Member |
|------------|-------|-------|-------------|-----------|--------|
| **Create Jobs** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Update Jobs** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Update Mitigations** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Flag/Unflag Jobs** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **View Flagged Jobs** | ✅ | ✅ | ✅ (auto) | ✅ | ✅ |
| **View Executive Summaries** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Invite/Deactivate Users** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Assign Roles** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Update Org Settings** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage Billing** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Deactivate Account** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Delete Organization** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Role Definitions

### Owner

**Purpose:** Ultimate institutional authority and legal accountability.

**Capabilities:**
- Full system access
- Organization identity management (name, billing)
- User lifecycle management (invite, deactivate, role assignment)
- All job and risk management operations
- Account deactivation

**Cannot:**
- Nothing (full authority)

**Rationale:** Someone must be legally accountable for the organization. Owners bear ultimate responsibility for risk decisions, billing, and organizational changes.

**Error Behavior:** N/A (no restrictions)

---

### Admin

**Purpose:** Operational control without ownership liability.

**Capabilities:**
- User management (invite, deactivate, assign roles)
- Job and mitigation management
- Flag/unflag jobs for review
- View all jobs and summaries

**Cannot:**
- Change organization identity (name)
- Manage billing or subscriptions
- Delete organization
- Deactivate account

**Rationale:** Admins manage people and operations, not organizational liability. They can execute risk management but cannot change the organization's legal identity or financial commitments.

**Error Behavior:** 
- `AUTH_ROLE_FORBIDDEN` (403) when attempting org settings updates

---

### Safety Lead

**Purpose:** Risk owner and operational risk authority.

**Capabilities:**
- See all flagged jobs automatically (governance visibility)
- Flag/unflag jobs for review
- Modify jobs and mitigations
- View Executive summaries and trends

**Cannot:**
- Manage billing or subscriptions
- Change organization identity
- Invite/deactivate users
- Deactivate account

**Rationale:** Safety Leads own operational risk exposure. They are the designated "risk owners" who must see all flagged jobs and can escalate risk signals. They do not manage organizational identity or financial commitments.

**Error Behavior:**
- `AUTH_ROLE_FORBIDDEN` (403) when attempting org/billing operations

**Special Behavior:**
- Flagged jobs are automatically visible to Safety Leads (UI filtering)
- This is a visibility enhancement, not a capability restriction

---

### Executive

**Purpose:** Oversight and visibility without operational interference.

**Capabilities:**
- View all jobs (read-only)
- View flagged jobs
- View Executive summaries, trends, and exports
- Access audit trails

**Cannot (hard-blocked server-side):**
- Create jobs
- Update jobs
- Update mitigations
- Flag/unflag jobs
- Change any data

**Rationale:** Executives observe risk and trends for strategic decision-making. They must not be able to edit history or interfere with operational risk management. Read-only access ensures audit integrity.

**Error Behavior:**
- `AUTH_ROLE_READ_ONLY` (403) for all write operations
- Applied to: `PATCH /api/jobs/:id`, `PATCH /api/jobs/:id/mitigations/:id`, `PATCH /api/jobs/:id/flag`

**Technical Enforcement:**
```typescript
if (role === 'executive') {
  return res.status(403).json({
    message: "Executives have read-only access",
    code: "AUTH_ROLE_READ_ONLY",
  });
}
```

---

### Member

**Purpose:** Day-to-day execution and job management.

**Capabilities:**
- Create jobs
- Update jobs (within scope)
- Add and update mitigations
- View jobs (standard visibility)

**Cannot:**
- Flag/unflag jobs (governance signal)
- Manage team members
- See Executive-only views
- Modify governance signals

**Rationale:** Members execute work and manage jobs, but do not own governance decisions. Flagging jobs is a risk escalation signal reserved for designated risk owners (Safety Lead, Admin, Owner).

**Error Behavior:**
- `AUTH_ROLE_FORBIDDEN` (403) when attempting to flag/unflag jobs
- Applied to: `PATCH /api/jobs/:id/flag`

**Technical Enforcement:**
```typescript
if (role === 'member' || role === 'executive') {
  return res.status(403).json({
    message: "You do not have permission to flag jobs for review",
    code: "AUTH_ROLE_FORBIDDEN",
  });
}
```

---

## Technical Enforcement

### API Layer Enforcement

All role capabilities are enforced at the **API layer**, not the UI. This ensures:

1. **Impossible privilege escalation**: UI cannot grant capabilities the API denies
2. **Deterministic behavior**: Same role always has same capabilities
3. **Audit clarity**: API logs show exact capability checks
4. **Client-agnostic**: Works regardless of client implementation

### Error Response Format

When a capability is denied, the API returns:

```json
{
  "message": "User-safe error message",
  "code": "AUTH_ROLE_FORBIDDEN" | "AUTH_ROLE_READ_ONLY",
  "request_id": "unique-request-id",
  "error_id": "unique-error-id"
}
```

**Status Codes:**
- `403 Forbidden`: Capability denied (`AUTH_ROLE_FORBIDDEN`, `AUTH_ROLE_READ_ONLY`)
- `401 Unauthorized`: Authentication required

### Enforcement Points

| Endpoint | Role Check | Error Code |
|----------|------------|------------|
| `PATCH /api/jobs/:id` | Executive → read-only | `AUTH_ROLE_READ_ONLY` |
| `PATCH /api/jobs/:id/mitigations/:id` | Executive → read-only | `AUTH_ROLE_READ_ONLY` |
| `PATCH /api/jobs/:id/flag` | Member/Executive → forbidden | `AUTH_ROLE_FORBIDDEN` |
| `PATCH /api/account/organization` | Admin → forbidden | `AUTH_ROLE_FORBIDDEN` |

---

## Audit & Compliance

### Audit Trail

All capability-denied attempts are logged with:
- User ID and role
- Requested action
- Error code
- Timestamp
- Request ID (for correlation)

### Legal Defensibility

This governance model enables statements like:

> "Only designated risk owners (Safety Lead, Admin, Owner) were technically capable of escalating risk signals. Members and Executives were server-enforced to be incapable of flagging jobs, making privilege escalation impossible."

This is **insurer-grade language** that demonstrates:
- Intentional authority design
- Provable accountability
- Immutable audit trails

---

## Why This Matters

### Most SaaS Tools Get This Wrong

**Common Anti-Patterns:**
- Hide buttons in UI (but API allows it)
- Trust the frontend
- Hope users behave correctly
- No server-side enforcement

**RiskMate Approach:**
- Enforce capabilities at the API layer
- Return explicit error codes
- Make drift impossible
- Document everything

### Enterprise Benefits

1. **No accidental privilege escalation**: Technically impossible
2. **No "oops, intern flagged a job"**: API blocks it
3. **No audit ambiguity**: Clear capability boundaries
4. **Legal defensibility**: Provable system design
5. **Insurer confidence**: Deterministic risk management

---

## Future Considerations

### Potential Enhancements (Not Yet Implemented)

- **Role hierarchies**: Nested role permissions
- **Custom roles**: Organization-defined roles
- **Temporary elevation**: Time-limited capability grants
- **Delegation**: Temporary role assignment

**Note:** These would require careful design to maintain audit integrity and legal defensibility.

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-17 | Initial governance model documentation |

---

## Related Documentation

- [API Error Contract](./API_ERRORS_v1.md): Error response format
- [Flag for Review Governance](./FLAG_FOR_REVIEW_GOVERNANCE.md): Flagging as governance primitive
- [Job Roster Strategic Summary](./JOB_ROSTER_STRATEGIC_SUMMARY.md): Risk ledger UI philosophy

---

**This document is a living reference. Update it when role capabilities change.**

