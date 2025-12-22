# Compliance Ledger Verification Checklist

## Migration Status
- [ ] Run: `supabase migration up` (or apply via Supabase dashboard)
- [ ] Verify: `category_tab` column exists on `audit_logs` table
- [ ] Verify: Old events have `category_tab` populated

## Card Workflow Smoke Tests

### Review Queue Card

#### Assign Action
- [ ] Select 1-2 events from Review Queue table
- [ ] Click "Assign" button
- [ ] Fill modal: assignee, due date, priority, notes
- [ ] Submit → Verify API call to `/api/review-queue/assign`
- [ ] Check: Success toast with "Assigned X item(s)"
- [ ] Verify: New `review_queue.assigned` ledger event appears in Operations tab
- [ ] Open drawer on new event → Verify all fields render correctly
- [ ] Test partial success: Try assigning an already-resolved item → Verify failed items stay selected

#### Resolve Action
- [ ] Select 1-2 events from Review Queue table
- [ ] Click "Resolve" button
- [ ] Fill modal: resolution notes (required), optionally waiver
- [ ] Submit → Verify API call to `/api/review-queue/resolve`
- [ ] Check: Success toast
- [ ] Verify: New `review_queue.resolved` or `review_queue.waived` ledger event appears
- [ ] Open drawer → Verify resolution details in metadata

#### Export (CSV/JSON)
- [ ] Set filters (time range, severity, etc.)
- [ ] Click "Export CSV" → Verify download with headers
- [ ] Verify: CSV includes `X-Export-*` headers in response
- [ ] Click "Export JSON" → Verify download
- [ ] Verify: JSON includes `meta` object with `exportedAt`, `view`, `filters`, `requestId`
- [ ] Test empty dataset → CSV has headers only, JSON is `[]` with meta

### Insurance-Ready Card

#### Generate Proof Pack
- [ ] Set time range filter (or leave default)
- [ ] Click "Generate Proof Pack"
- [ ] Verify API call to `/api/proof-packs` (or export endpoint)
- [ ] Verify: ZIP download with PDF + CSVs + manifest.json
- [ ] Verify: `proof_pack.generated` ledger event appears
- [ ] Extract ZIP → Verify all files present and readable

#### Export (CSV/JSON)
- [ ] Click "Export CSV" → Verify download
- [ ] Verify: Insurance-ready data format (completed work records + controls + attestations)

### Governance Enforcement Card

#### Export Enforcement Report
- [ ] Set time range filter
- [ ] Click "Export PDF" → Verify PDF download
- [ ] Click "Export CSV" → Verify CSV download
- [ ] Click "Export JSON" → Verify JSON download
- [ ] Verify: `enforcement_report.exported` ledger event (if implemented)
- [ ] Verify: Only governance events (role violations, policy denials) in export

### Incident Review Card

#### Create Corrective Action
- [ ] Select 1 incident event from Incident Review table
- [ ] Click "Create Corrective Action"
- [ ] Fill modal: title, owner, due date, severity, notes
- [ ] Submit → Verify API call to `/api/incidents/corrective-action`
- [ ] Verify: New corrective action (mitigation item) created
- [ ] Verify: `incident.corrective_action_created` ledger event appears
- [ ] Open drawer → Verify corrective action details

#### Close Incident
- [ ] Select 1 incident with corrective actions
- [ ] Click "Close Incident"
- [ ] Fill modal: closure notes, root cause, attestation checkbox
- [ ] Submit → Verify API call to `/api/incidents/close`
- [ ] Verify: `incident.closed` ledger event appears
- [ ] Verify: Incident status updated (if applicable)
- [ ] Test guardrail: Try closing with open corrective actions → Should block or require override

#### Export (CSV/JSON)
- [ ] Click "Export CSV" → Verify incident timeline format
- [ ] Verify: Includes work record IDs, corrective actions, evidence links

### Access Review Card

#### Revoke Access
- [ ] Select 1 user or access event from Access Review table
- [ ] Click "Revoke Access"
- [ ] Fill modal: reason (required), force logout toggle
- [ ] Submit → Verify API call to `/api/access/revoke`
- [ ] Verify: `access.revoked` ledger event appears
- [ ] Verify: `session.terminated` event if force_logout=true
- [ ] Test guardrail: Try revoking own access → Should block
- [ ] Test guardrail: Executive trying to revoke → Should 403

#### Flag Suspicious
- [ ] Select 1 access event
- [ ] Click "Flag Suspicious"
- [ ] Fill modal: reason, severity
- [ ] Submit → Verify API call to `/api/access/flag-suspicious`
- [ ] Verify: `access.flagged_suspicious` ledger event appears
- [ ] Verify: Review Queue item auto-created (bridge to Review Queue)

#### Export (CSV/JSON)
- [ ] Click "Export CSV" → Verify access change log format
- [ ] Verify: Includes role changes, grants, revokes, logins

## General Verification

### Tab Categorization
- [ ] Set time range to "All time"
- [ ] Governance tab: Shows only governance events (role violations, policy denials)
- [ ] Operations tab: Shows only operational actions (assign, resolve, corrective actions)
- [ ] Access tab: Shows only access events (revokes, flags, role changes)
- [ ] Verify: Old events (pre-migration) appear in correct tabs
- [ ] Verify: New events (post-migration) appear in correct tabs

### EventDetailsDrawer
- [ ] Open drawer on various event types
- [ ] Verify: No crashes on missing optional fields
- [ ] Verify: All copy operations work (Actor ID, metadata JSON, full event JSON)
- [ ] Verify: Links to work records work (if job_id present)
- [ ] Verify: All fields render correctly (event name, severity, outcome, actor, target, timestamp, metadata)

### Dev Helper (Development Only)
- [ ] Click "Generate Sample Events" (dev-only button)
- [ ] Verify: 3 events generated (1 per tab)
- [ ] Verify: Events appear in correct tabs
- [ ] Verify: Events have realistic foreign keys when available
- [ ] Verify: Drawer shows all event details correctly

### Role Enforcement
- [ ] Login as Executive role
- [ ] Verify: Mutation buttons (Assign, Resolve, Revoke, etc.) are disabled with tooltip
- [ ] Verify: Export buttons still work (read-only operations)
- [ ] Attempt direct API call as Executive → Verify 403 response
- [ ] Verify: `auth.role_violation` ledger event created

### Bulk Operations
- [ ] Select multiple items (3-5)
- [ ] Perform bulk action (Assign or Resolve)
- [ ] Verify: Partial success handling works correctly
- [ ] Verify: Failed items stay selected, succeeded items cleared
- [ ] Verify: Detailed failure modal/expandable toast shows failures with IDs and reasons

### Empty States
- [ ] Set filters to return zero results
- [ ] Verify: Appropriate empty state message per tab
- [ ] Verify: Export still works (returns headers-only CSV or empty JSON array)

## Production Safety Checks

- [ ] Verify: `/api/dev/generate-sample-events` returns 404 in production (not 403)
- [ ] Verify: Dev helper button only shows in development mode
- [ ] Verify: All error responses include `requestId`
- [ ] Verify: All exports include proper `Content-Type` and `Content-Disposition` headers
- [ ] Verify: CSV exports always include headers even for empty results
- [ ] Verify: JSON exports always include `meta` object

## Related Events (Future Enhancement)
- [ ] _TODO: Add related events panel in drawer showing events with same job_id/target_id_
- [ ] _TODO: Implement API endpoint to fetch related events_
- [ ] _TODO: Add click-through to related events in drawer_

