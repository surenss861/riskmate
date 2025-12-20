# Compliance Ledger as Single Source of Truth

**Status:** Active  
**Version:** 1.0.0  
**Effective Date:** January 2025

## Overview

The Compliance Ledger is RiskMate's single source of truth for all meaningful actions that affect safety, compliance, insurance defensibility, payments, or disputes. Every page and feature routes into the Ledger, making it the central hub for audit, compliance, and governance evidence.

## Core Principle: "Ledger is Law"

**Every meaningful action must generate an audit event. No exceptions.**

If an action can affect:
- Safety
- Compliance
- Insurance defensibility
- Payments
- Disputes

→ It writes to the Ledger.

## Canonical Actions (Always Logged)

### Job Lifecycle
- `job.created` - New job record created
- `job.updated` - Job details modified
- `job.archived` - Job moved to archived status
- `job.deleted` - Job permanently removed (strict eligibility)
- `job.risk_score_changed` - Risk score updated due to factor changes

### Review & Governance
- `job.flagged_for_review` - Job marked for safety lead review
- `job.unflagged` - Review flag removed
- `job.review_assigned` - Review responsibility assigned
- `job.review_note_added` - Review comment recorded
- `job.review_resolved` - Review completed with outcome

### Risk & Mitigation
- `mitigation.completed` - Mitigation action completed
- `mitigation.updated` - Mitigation checklist item modified

### Evidence & Documentation
- `document.uploaded` - Document/photo/permit attached
- `photo.uploaded` - Evidence photo added
- `proof_pack.{type}_generated` - Proof pack exported (insurance/audit/incident/compliance)

### Sign-offs & Approvals
- `job.signoff_created` - Digital sign-off captured
- `job.signoff_signed` - Sign-off completed
- `job.signoff_rejected` - Sign-off rejected

### Governance Enforcement
- `auth.role_violation` - Action blocked due to insufficient permissions
- `account.organization_updated` - Organization settings changed

### Access & Security
- `team.invite_sent` - User invitation sent
- `team.invite_accepted` - User joined organization
- `team.member_removed` - Access revoked
- `team.role_changed` - User role modified
- `security.login` - User authenticated
- `security.password_changed` - Password updated
- `security.session_revoked` - Session terminated

### Billing & Subscriptions
- `billing.subscription_created` - Subscription activated
- `billing.subscription_updated` - Subscription modified
- `billing.plan_changed` - Plan tier changed
- `billing.subscription_canceled` - Subscription canceled

### Exports & Sharing
- `audit.export` - Compliance Ledger exported (CSV/JSON/PDF)

## Review Queue

The Review Queue is a saved view that answers: **"What needs attention right now?"**

### Rules
- Jobs flagged for review (`review_flag = true`)
- Critical or material severity events (last 30 days)
- Blocked governance actions (policy violations)
- Missing required sign-offs (per job requirements)
- Open incidents (flagged + high risk)

### Implementation
- Saved view preset: `review-queue`
- Shows across all categories (not tab-filtered)
- Default sorting: Most recent first
- One-click export: CSV/JSON

## Two-Layer Architecture

### Layer 1: Review Queue (Derived View)
- **Purpose:** "What needs attention right now?"
- **Content:** Filtered subset of Ledger events requiring action
- **Access:** All roles (visibility varies by role)

### Layer 2: Ledger History (Complete Evidence)
- **Purpose:** "Everything that happened, filterable and exportable"
- **Content:** Complete audit trail with all events
- **Access:** Role-based (Owner/Admin/Safety Lead/Executive)

## Navigation Pattern: Everything Routes to Ledger

### Job Detail Page
- **"View in Compliance Ledger"** button → `/operations/audit?job_id={id}`
- Opens Ledger filtered to that job's events

### Job Roster
- **"Ledger"** link in Actions column → `/operations/audit?job_id={id}`
- Quick access to job's complete action history

### Job Packet View
- **"View complete action history in Compliance Ledger"** link → `/operations/audit?job_id={id}`
- Links to full timeline beyond packet summary

### Executive Snapshot
- **"View complete evidence in Compliance Ledger"** link → `/operations/audit?view=review-queue&severity=material`
- Opens Review Queue filtered to material/critical events

### Sites Page
- **"View site compliance"** → `/operations/audit?site_id={id}` (future)

## Event Enrichment

All events are automatically enriched server-side with:
- **Actor:** Name, role, email
- **Target:** Job title, risk score, flagged status, site name
- **Context:** Review reason, assigned role, due date (for flagged events)
- **Exposure:** Insurance/regulatory/owner impact (for violations)

## Review Context Display

For flagged/review events, the UI shows:
- **Reason:** Why the job was flagged
- **Assigned To:** Review owner role (e.g., "safety_lead")
- **Due Date:** Review deadline (if set)

This makes the Ledger the review timeline, not just a log.

## Export Capabilities

### Export Types
- **CSV:** Tabular format with header block (Export ID, filters, verification)
- **JSON:** Structured bundle with metadata and integrity info
- **PDF:** (Coming in v2)

### Export Headers Include
- Export ID (unique reference)
- Generated timestamp
- Generated by (name/role)
- Organization
- View preset + filters applied
- Time range
- Event count
- Hash chain verification status ✅

## Industry-Specific Language

The Ledger adapts terminology based on organization's vertical:
- **Facilities:** Work Order, Facility, Compliance Packet
- **Fire & Life Safety:** Inspection, Location, Inspection Report
- **Heavy Civil:** Work Package, Project/Corridor, Owner/Regulator Packet
- **Commercial Contractors:** Job, Site, Client Compliance Packet
- **Residential Trades:** Job, Location, Insurance Packet

## Saved Views (Compliance Modes)

1. **Review Queue** (Default)
   - What needs attention now
   - Flagged jobs, critical events, blocked actions

2. **Insurance-Ready**
   - Completed jobs + proof packs + sign-offs
   - Ready for insurer request

3. **Governance Enforcement**
   - Blocked actions + policy violations
   - Proves role enforcement

4. **Incident Review**
   - Flagged jobs + escalations + mitigation actions
   - Complete incident trail

5. **Access Review**
   - Role changes + login events + access revocations
   - Security audit trail

## Evidence Drawer

Clicking any evidence link opens a side panel showing:
- **Related Resource:** Job/site info with quick links
- **Timeline:** All events related to that resource
- **One-Click Export:** "Export Evidence Slice" for that specific job/resource

## Technical Implementation

### Backend
- Standardized event schema with auto-enrichment
- Hash chain for tamper evidence
- Comprehensive indexes for fast filtering
- Server-side enrichment (no frontend guessing)

### Frontend
- Saved view cards (not dropdowns)
- Industry language mapping
- Review context inline rendering
- Evidence drawer for contextual views
- Export with headers and verification

## Migration Path

All existing features now:
1. Log events to Ledger (if not already)
2. Link to Ledger from detail pages
3. Use Ledger as the source of truth for "what happened"

No new pages needed. Everything becomes a filtered view or shortcut into the Ledger.

## Success Metrics

- **Zero "Unknown" events** - All events mapped and human-readable
- **Complete coverage** - Every meaningful action generates an event
- **Fast filtering** - Sub-100ms queries even at scale
- **Export-ready** - All exports include headers, IDs, verification
- **Buyer-trustworthy** - Feels like compliance product, not dev tool

