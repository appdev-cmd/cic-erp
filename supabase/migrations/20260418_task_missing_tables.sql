-- ============================================================
-- Migration: Task Missing Tables
-- Created: 2026-04-18
-- Description: Tạo 3 bảng còn thiếu cho module Công Việc
--   1. task_personal_tags     - Tags cá nhân theo user
--   2. contract_task_definitions - Task milestone từ hợp đồng
--   3. task_automation_rules  - Quy tắc tự động hóa
-- ============================================================

-- ──────────────────────────────────────────
-- 1. task_personal_tags
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_personal_tags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  task_id     uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag         text        NOT NULL CHECK (char_length(tag) > 0 AND char_length(tag) <= 50),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id, tag)
);

-- Index for fast lookup by user + task
CREATE INDEX IF NOT EXISTS idx_task_personal_tags_user_task
  ON task_personal_tags(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_task_personal_tags_task
  ON task_personal_tags(task_id);

-- RLS: only the owning user can see/manage their personal tags
ALTER TABLE task_personal_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personal_tags_select_own"
  ON task_personal_tags FOR SELECT
  USING (user_id = (
    SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "personal_tags_insert_own"
  ON task_personal_tags FOR INSERT
  WITH CHECK (user_id = (
    SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "personal_tags_update_own"
  ON task_personal_tags FOR UPDATE
  USING (user_id = (
    SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "personal_tags_delete_own"
  ON task_personal_tags FOR DELETE
  USING (user_id = (
    SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1
  ));

-- ──────────────────────────────────────────
-- 2. contract_task_definitions
-- ──────────────────────────────────────────
-- Định nghĩa các milestone task được sinh tự động từ hợp đồng
CREATE TABLE IF NOT EXISTS contract_task_definitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid        NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  description     text,
  -- Milestone trigger: số ngày sau khi ký hợp đồng OR ngày tuyệt đối
  offset_days     int,                    -- NULL nếu dùng fixed_date
  fixed_date      date,                   -- NULL nếu dùng offset_days
  -- Assignee resolution: specific employee hoặc role-based
  assignee_employee_id  uuid REFERENCES employees(id) ON DELETE SET NULL,
  assignee_role         text,             -- e.g. 'project_manager', 'legal'
  priority        text        NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_task_defs_contract
  ON contract_task_definitions(contract_id);

-- RLS: admin + legal can manage; all authenticated users can view
ALTER TABLE contract_task_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_task_defs_select"
  ON contract_task_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "contract_task_defs_insert_admin"
  ON contract_task_definitions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'director', 'legal')
    )
  );

CREATE POLICY "contract_task_defs_update_admin"
  ON contract_task_definitions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'director', 'legal')
    )
  );

CREATE POLICY "contract_task_defs_delete_admin"
  ON contract_task_definitions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'director')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_contract_task_def_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contract_task_def_updated_at
  BEFORE UPDATE ON contract_task_definitions
  FOR EACH ROW EXECUTE FUNCTION update_contract_task_def_updated_at();

-- ──────────────────────────────────────────
-- 3. task_automation_rules
-- ──────────────────────────────────────────
-- Quy tắc "nếu X thì tự động Y" cho tasks
CREATE TABLE IF NOT EXISTS task_automation_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  description     text,
  -- Trigger condition (stored as JSONB for flexibility)
  trigger_event   text        NOT NULL
                  CHECK (trigger_event IN (
                    'task_created', 'task_completed', 'status_changed',
                    'deadline_passed', 'task_assigned', 'comment_added'
                  )),
  trigger_config  jsonb       NOT NULL DEFAULT '{}',
  -- Action to execute
  action_type     text        NOT NULL
                  CHECK (action_type IN (
                    'create_task', 'send_notification', 'change_status',
                    'assign_task', 'tag_task', 'set_deadline'
                  )),
  action_config   jsonb       NOT NULL DEFAULT '{}',
  -- Scope: project-wide OR entity-specific
  scope_type      text        CHECK (scope_type IN ('global', 'project', 'contract')),
  scope_id        uuid,
  -- Template for task creation actions
  task_template   jsonb,
  -- Assignee resolution for task creation
  assignee_mode   text        CHECK (assignee_mode IN ('specific', 'role', 'creator', 'workload')),
  assignee_value  text,       -- employee_id OR role name
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES employees(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_automation_rules_trigger
  ON task_automation_rules(trigger_event, is_active);
CREATE INDEX IF NOT EXISTS idx_task_automation_rules_scope
  ON task_automation_rules(scope_type, scope_id);

-- RLS: admin can manage, all can view active rules
ALTER TABLE task_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_automation_select"
  ON task_automation_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "task_automation_insert_admin"
  ON task_automation_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "task_automation_update_admin"
  ON task_automation_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "task_automation_delete_admin"
  ON task_automation_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_task_automation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_automation_updated_at
  BEFORE UPDATE ON task_automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_task_automation_updated_at();
