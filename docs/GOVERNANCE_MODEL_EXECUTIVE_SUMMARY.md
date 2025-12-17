# RiskMate Governance Model
## Executive Summary

**Version 1.0 | Effective January 2025**

---

## Overview

RiskMate implements a **capability-constrained risk governance system** where authority is intentional, accountability is provable, and history cannot be rewritten. All role capabilities are **server-enforced at the API layer**, making privilege escalation impossible.

---

## Role Capability Matrix

| Capability | Owner | Admin | Safety Lead | Executive | Member |
|------------|-------|-------|-------------|-----------|--------|
| **Create Jobs** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Update Jobs** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Flag/Unflag Jobs** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **View Flagged Jobs** | ✅ | ✅ | ✅ (auto) | ✅ | ✅ |
| **View Executive Summaries** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Manage Team** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Update Org Settings** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Manage Billing** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Key Roles

**Owner**  
Ultimate institutional authority. Full system access, including organization identity and billing management.

**Admin**  
Operational control without ownership liability. Can manage team and risk operations, but cannot change organization identity or billing.

**Safety Lead**  
Risk owner and operational risk authority. Sees all flagged jobs automatically, can escalate risk signals. Does not manage organizational identity or financial commitments.

**Executive**  
Oversight without interference. Read-only access to all jobs, trends, and summaries. Cannot modify any data.

**Member**  
Day-to-day execution. Can create and update jobs, but cannot flag jobs (governance signal) or manage team.

---

## Technical Enforcement

- **API-level enforcement**: Capabilities are enforced at the API layer, not just the UI
- **Explicit error codes**: `AUTH_ROLE_FORBIDDEN`, `AUTH_ROLE_READ_ONLY`
- **Audit logging**: All capability violations are logged with role, action, and result
- **Deterministic behavior**: Same role always has same capabilities, regardless of client

---

## Legal Defensibility

**Key Statement:**

> "Only designated risk owners (Safety Lead, Admin, Owner) were technically capable of escalating risk signals. Members and Executives were server-enforced to be incapable of flagging jobs, making privilege escalation impossible."

This enables:
- **Reduced organizational liability**: Clear assignment of responsibility
- **Eliminated ambiguity**: No "user error" claims
- **Audit integrity**: Provable system design
- **Insurer confidence**: Deterministic risk management

---

## Compliance & Audit

- All access changes are recorded for compliance and audit review
- Capability violations are logged with full context (role, action, result)
- Legal acceptance is tracked per user and organization
- Audit trails are immutable once created

---

## Related Documentation

- **Full Governance Model**: See `GOVERNANCE_MODEL.md` for complete technical details
- **API Error Contract**: See `API_ERRORS_v1.md` for error response format
- **Flag for Review**: See `FLAG_FOR_REVIEW_GOVERNANCE.md` for governance primitive details

---

**This document is a condensed version of the full Governance Model. For technical implementation details, role definitions, and enforcement mechanisms, refer to the complete documentation.**

