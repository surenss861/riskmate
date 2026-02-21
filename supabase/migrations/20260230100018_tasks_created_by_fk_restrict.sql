-- tasks.created_by is NOT NULL; FK must not use ON DELETE SET NULL.
-- Drop the old FK and add one with ON DELETE RESTRICT so user deletion is blocked
-- when they created tasks, instead of attempting to set NULL on a NOT NULL column.

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT;
