-- =============================================
-- FIX: Drop old incomplete tasks/task_comments tables, recreate with full schema
-- Run this BEFORE the main migration
-- =============================================

-- Drop dependent tables first (FK constraints)
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS task_links CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS task_statuses CASCADE;
DROP TABLE IF EXISTS entity_registry CASCADE;

-- Now run the full migration:

-- 1. Entity Registry
CREATE TABLE entity_registry (
  entity_type text PRIMARY KEY,
  label text NOT NULL,
  icon text,
  color text,
  url_pattern text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO entity_registry (entity_type, label, icon, color, url_pattern) VALUES
  ('contract', 'Hợp đồng', 'FileText', '#f97316', '/contracts/:id'),
  ('customer', 'Đối tác', 'Handshake', '#3b82f6', '/customers/:id'),
  ('payment', 'Phiếu thu/chi', 'Wallet', '#10b981', '/payments?id=:id'),
  ('employee', 'Nhân viên', 'User', '#8b5cf6', '/personnel/:slug'),
  ('product', 'Sản phẩm/DV', 'Package', '#ec4899', '/products/:id'),
  ('unit', 'Đơn vị', 'Building2', '#6366f1', '/units/:id'),
  ('business_plan', 'PAKD', 'ClipboardCheck', '#14b8a6', '/contracts/:id#pakd'),
  ('task', 'Công việc', 'CheckSquare', '#f59e0b', '/tasks/:id');

-- 2. Task Statuses
CREATE TABLE task_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid,
  name text NOT NULL,
  color text DEFAULT '#94a3b8',
  sort_order int DEFAULT 0,
  is_done boolean DEFAULT false,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

INSERT INTO task_statuses (name, color, sort_order, is_done, is_default) VALUES
  ('Cần làm', '#94a3b8', 0, false, true),
  ('Đang tiến hành', '#3b82f6', 1, false, false),
  ('Đang review', '#f59e0b', 2, false, false),
  ('Hoàn thành', '#10b981', 3, true, false),
  ('Hủy', '#ef4444', 4, true, false);

-- 3. Employees management columns
ALTER TABLE employees ADD COLUMN IF NOT EXISTS management_rank int DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS managed_unit_ids text[] DEFAULT '{}';

-- 4. Tasks (full schema)
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid,
  folder_id uuid,
  list_id uuid,
  parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status_id uuid REFERENCES task_statuses(id),
  priority text DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
  sort_order int DEFAULT 0,
  tags text[] DEFAULT '{}',
  assignees text[] DEFAULT '{}',
  watchers text[] DEFAULT '{}',
  supporters text[] DEFAULT '{}',
  approvers text[] DEFAULT '{}',
  start_date date,
  due_date date,
  time_estimate int,
  time_spent int DEFAULT 0,
  completed_at timestamptz,
  completed_by text,
  source_module text,
  source_event text,
  source_entity_id text,
  auto_generated boolean DEFAULT false,
  action_type text,
  action_config jsonb,
  action_label text,
  completion_trigger text,
  custom_fields jsonb DEFAULT '{}',
  is_private boolean DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tasks_assignees ON tasks USING GIN (assignees);
CREATE INDEX idx_tasks_watchers ON tasks USING GIN (watchers);
CREATE INDEX idx_tasks_status ON tasks (status_id);
CREATE INDEX idx_tasks_due_date ON tasks (due_date);
CREATE INDEX idx_tasks_source ON tasks (source_module, source_entity_id);
CREATE INDEX idx_tasks_parent ON tasks (parent_id);
CREATE INDEX idx_tasks_created_by ON tasks (created_by);

CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

-- 5. Task Links
CREATE TABLE task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_label text,
  link_type text DEFAULT 'related',
  url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_task_links_task ON task_links (task_id);
CREATE INDEX idx_task_links_entity ON task_links (entity_type, entity_id);

-- 6. Task Comments
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES task_comments(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  content text NOT NULL,
  comment_type text DEFAULT 'user' CHECK (comment_type IN ('user', 'system', 'mention')),
  reactions jsonb DEFAULT '{}',
  attachments jsonb DEFAULT '[]',
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_task_comments_task ON task_comments (task_id);
CREATE INDEX idx_task_comments_parent ON task_comments (parent_comment_id);
