-- Tasks FKs must reference auth.users(id) per spec and existing auth schema
-- (not public.users). Recreate assigned_to, created_by, completed_by with
-- auth.users and appropriate ON DELETE actions.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_completed_by_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
