-- Comment 1: Tighten task_templates SELECT to org-scoped only (no is_default leak across orgs).
DROP POLICY IF EXISTS "Users can read task templates in their organization or defaults" ON task_templates;
DROP POLICY IF EXISTS "Users can read task templates in their organization" ON task_templates;
CREATE POLICY "Users can read task templates in their organization"
  ON task_templates FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Comment 1 & 2: Backfill — ensure every organization has the three default templates (idempotent by organization_id + name).
INSERT INTO task_templates (id, organization_id, is_default, name, tasks, job_type, created_by)
SELECT gen_random_uuid(), o.id, true, 'Electrical Inspection',
  '[{"title":"Isolate power","sort_order":0},{"title":"Test circuits","sort_order":1},{"title":"Document findings","sort_order":2},{"title":"Sign off","sort_order":3}]'::jsonb,
  'electrical', NULL::uuid
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM task_templates tt WHERE tt.organization_id = o.id AND tt.name = 'Electrical Inspection')
UNION ALL
SELECT gen_random_uuid(), o.id, true, 'Plumbing Repair',
  '[{"title":"Shut off water","sort_order":0},{"title":"Inspect pipes","sort_order":1},{"title":"Complete repair","sort_order":2},{"title":"Test pressure","sort_order":3}]'::jsonb,
  'plumbing', NULL::uuid
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM task_templates tt WHERE tt.organization_id = o.id AND tt.name = 'Plumbing Repair')
UNION ALL
SELECT gen_random_uuid(), o.id, true, 'Safety Audit',
  '[{"title":"Review hazards","sort_order":0},{"title":"Check controls","sort_order":1},{"title":"Verify PPE","sort_order":2},{"title":"Complete checklist","sort_order":3}]'::jsonb,
  'safety', NULL::uuid
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM task_templates tt WHERE tt.organization_id = o.id AND tt.name = 'Safety Audit');

-- Remove duplicate default templates per (organization_id, name), keeping one row per org/name.
DELETE FROM task_templates a
USING task_templates b
WHERE a.organization_id = b.organization_id
  AND a.name = b.name
  AND a.is_default = true
  AND b.is_default = true
  AND a.id > b.id;
