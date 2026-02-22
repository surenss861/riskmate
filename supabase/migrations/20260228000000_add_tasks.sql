CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false NOT NULL,
  name TEXT NOT NULL,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  job_type TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_job ON tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date) WHERE status != 'done';

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read tasks in their organization" ON tasks;
CREATE POLICY "Users can read tasks in their organization"
  ON tasks FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create tasks in their organization" ON tasks;
CREATE POLICY "Users can create tasks in their organization"
  ON tasks FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update tasks in their organization" ON tasks;
CREATE POLICY "Users can update tasks in their organization"
  ON tasks FOR UPDATE
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete tasks in their organization" ON tasks;
CREATE POLICY "Users can delete tasks in their organization"
  ON tasks FOR DELETE
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can read task templates in their organization or defaults" ON task_templates;
CREATE POLICY "Users can read task templates in their organization or defaults"
  ON task_templates FOR SELECT
  USING (organization_id = get_user_organization_id() OR is_default = true);

DROP POLICY IF EXISTS "Users can create task templates in their organization" ON task_templates;
CREATE POLICY "Users can create task templates in their organization"
  ON task_templates FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update task templates in their organization" ON task_templates;
CREATE POLICY "Users can update task templates in their organization"
  ON task_templates FOR UPDATE
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete task templates in their organization" ON task_templates;
CREATE POLICY "Users can delete task templates in their organization"
  ON task_templates FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Seed default templates for existing organizations (if any)
INSERT INTO task_templates (id, organization_id, is_default, name, tasks, job_type, created_by)
SELECT gen_random_uuid(), o.id, true, 'Electrical Inspection',
  '[{"title":"Isolate power","sort_order":0},{"title":"Test circuits","sort_order":1},{"title":"Document findings","sort_order":2},{"title":"Sign off","sort_order":3}]'::jsonb,
  'electrical', NULL::uuid
FROM (SELECT id FROM organizations LIMIT 1) o
UNION ALL
SELECT gen_random_uuid(), o.id, true, 'Plumbing Repair',
  '[{"title":"Shut off water","sort_order":0},{"title":"Inspect pipes","sort_order":1},{"title":"Complete repair","sort_order":2},{"title":"Test pressure","sort_order":3}]'::jsonb,
  'plumbing', NULL::uuid
FROM (SELECT id FROM organizations LIMIT 1) o
UNION ALL
SELECT gen_random_uuid(), o.id, true, 'Safety Audit',
  '[{"title":"Review hazards","sort_order":0},{"title":"Check controls","sort_order":1},{"title":"Verify PPE","sort_order":2},{"title":"Complete checklist","sort_order":3}]'::jsonb,
  'safety', NULL::uuid
FROM (SELECT id FROM organizations LIMIT 1) o;

-- Ensure new organizations get the three default templates (fresh DB with zero orgs gets them on first org creation)
CREATE OR REPLACE FUNCTION seed_default_task_templates_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO task_templates (id, organization_id, is_default, name, tasks, job_type, created_by)
  VALUES
    (gen_random_uuid(), NEW.id, true, 'Electrical Inspection',
     '[{"title":"Isolate power","sort_order":0},{"title":"Test circuits","sort_order":1},{"title":"Document findings","sort_order":2},{"title":"Sign off","sort_order":3}]'::jsonb,
     'electrical', NULL),
    (gen_random_uuid(), NEW.id, true, 'Plumbing Repair',
     '[{"title":"Shut off water","sort_order":0},{"title":"Inspect pipes","sort_order":1},{"title":"Complete repair","sort_order":2},{"title":"Test pressure","sort_order":3}]'::jsonb,
     'plumbing', NULL),
    (gen_random_uuid(), NEW.id, true, 'Safety Audit',
     '[{"title":"Review hazards","sort_order":0},{"title":"Check controls","sort_order":1},{"title":"Verify PPE","sort_order":2},{"title":"Complete checklist","sort_order":3}]'::jsonb,
     'safety', NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_default_task_templates_trigger ON organizations;
CREATE TRIGGER seed_default_task_templates_trigger
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_task_templates_for_org();
