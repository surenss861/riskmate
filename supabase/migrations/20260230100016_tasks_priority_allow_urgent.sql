-- Allow 'urgent' in tasks.priority to match code/types (fixes 500s from CHECK violation).
-- Only run when tasks table exists (e.g. add_tasks migration already applied).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
    ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
  END IF;
END $$;
