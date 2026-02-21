-- Enforce tasks.created_by NOT NULL to match spec and notification reliance.
-- Fix existing null rows by setting created_by to first user in same organization,
-- then remove any tasks that still have null (org has no users), then set NOT NULL.

UPDATE tasks t
SET created_by = (
  SELECT u.id FROM users u WHERE u.organization_id = t.organization_id LIMIT 1
)
WHERE t.created_by IS NULL;

DELETE FROM tasks WHERE created_by IS NULL;

ALTER TABLE tasks ALTER COLUMN created_by SET NOT NULL;
