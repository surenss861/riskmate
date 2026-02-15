-- Migration: Recategorize existing audit events to use canonical categories
-- This ensures old events with legacy category values are mapped correctly

-- Update category based on event_name patterns (for events that don't have a proper category yet)
-- Governance Enforcement: blocked actions, policy enforcement, violations
UPDATE audit_logs
SET category = 'governance'
WHERE (
  event_name LIKE '%auth.role_violation%' OR
  event_name LIKE '%policy.denied%' OR
  event_name LIKE '%rls.denied%' OR
  event_name LIKE '%enforcement.blocked%' OR
  event_name LIKE '%governance.enforcement%' OR
  event_name LIKE '%violation%'
)
AND category NOT IN ('governance', 'review_queue', 'incident_review', 'attestations', 'system', 'access', 'access_review');

-- Access & Security: identity + permissions changes
UPDATE audit_logs
SET category = 'access'
WHERE (
  event_name LIKE '%access.%' OR
  event_name LIKE '%role.changed%' OR
  event_name LIKE '%permission.%' OR
  event_name LIKE '%login.%' OR
  event_name LIKE '%session.terminated%' OR
  event_name LIKE '%team.%' OR
  event_name LIKE '%security.%'
)
AND category NOT IN ('governance', 'review_queue', 'incident_review', 'attestations', 'system');

-- Review Queue: review-related actions
UPDATE audit_logs
SET category = 'review_queue'
WHERE (
  event_name LIKE '%review_queue.%' OR
  (event_name LIKE '%review.%' AND event_name NOT LIKE '%access_review%')
)
AND category NOT IN ('governance', 'incident_review', 'attestations', 'system', 'access', 'access_review');

-- Incident Review: incident-related actions
UPDATE audit_logs
SET category = 'incident_review'
WHERE (
  event_name LIKE '%incident.%'
)
AND category NOT IN ('governance', 'review_queue', 'attestations', 'system', 'access', 'access_review');

-- System/Exports: proof packs, exports
UPDATE audit_logs
SET category = 'system'
WHERE (
  event_name LIKE '%proof_pack.%' OR
  event_name LIKE '%export.%' OR
  event_name LIKE '%system.%'
)
AND category NOT IN ('governance', 'review_queue', 'incident_review', 'attestations', 'access', 'access_review');

-- Attestations: signoffs and attestations
UPDATE audit_logs
SET category = 'attestations'
WHERE (
  event_name LIKE '%attestation.%' OR
  event_name LIKE '%signoff%'
)
AND category NOT IN ('governance', 'review_queue', 'incident_review', 'system', 'access', 'access_review');

-- Default to operations for any remaining unset or invalid categories
UPDATE audit_logs
SET category = 'operations'
WHERE category IS NULL
OR category NOT IN ('governance', 'operations', 'access', 'review_queue', 'incident_review', 'attestations', 'system', 'access_review');

-- Update legacy category values to canonical ones
UPDATE audit_logs
SET category = 'governance'
WHERE category IN ('governance_enforcement', 'enforcement');

UPDATE audit_logs
SET category = 'access'
WHERE category IN ('access_security', 'security');

UPDATE audit_logs
SET category = 'operations'
WHERE category IN ('operational_actions', 'work', 'job');

-- Note: This migration is idempotent - running it multiple times is safe
-- Events that already have correct categories will not be updated
