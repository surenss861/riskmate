-- Backfill task_templates with null organization_id: assign to first org or delete
UPDATE task_templates
SET organization_id = (SELECT id FROM organizations LIMIT 1)
WHERE organization_id IS NULL
  AND EXISTS (SELECT 1 FROM organizations LIMIT 1);

DELETE FROM task_templates
WHERE organization_id IS NULL;

ALTER TABLE task_templates
  ALTER COLUMN organization_id SET NOT NULL;
