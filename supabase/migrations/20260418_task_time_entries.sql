-- ============================================================
-- Migration: Task Time Entries
-- Created: 2026-04-18
-- Description: Bảng log giờ làm việc cho module Time Tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS task_time_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  -- Computed duration in minutes (auto-calculated when ended_at is set)
  duration_minutes int         GENERATED ALWAYS AS (
    CASE
      WHEN ended_at IS NOT NULL
      THEN GREATEST(0, EXTRACT(EPOCH FROM (ended_at - started_at))::int / 60)
      ELSE NULL
    END
  ) STORED,
  description      text,
  is_running       boolean     NOT NULL DEFAULT false, -- true khi timer đang chạy
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Constraint: ended_at must be after started_at
  CONSTRAINT tte_ended_after_started CHECK (ended_at IS NULL OR ended_at > started_at),
  -- Only one running timer per user per task at a time
  CONSTRAINT tte_one_running_per_user EXCLUDE USING gist (
    user_id WITH =,
    task_id WITH =,
    is_running WITH =
  ) WHERE (is_running = true) DEFERRABLE INITIALLY DEFERRED
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_time_entries_task
  ON task_time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_user
  ON task_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_running
  ON task_time_entries(user_id, is_running) WHERE is_running = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_task_time_entry_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_time_entry_updated_at
  BEFORE UPDATE ON task_time_entries
  FOR EACH ROW EXECUTE FUNCTION update_task_time_entry_updated_at();

-- Auto-sync time_spent on tasks table when entries change
CREATE OR REPLACE FUNCTION sync_task_time_spent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task_id uuid;
  v_total   int;
BEGIN
  v_task_id := COALESCE(NEW.task_id, OLD.task_id);
  SELECT COALESCE(SUM(duration_minutes), 0)
    INTO v_total
    FROM task_time_entries
   WHERE task_id = v_task_id AND ended_at IS NOT NULL;

  UPDATE tasks SET time_spent = v_total WHERE id = v_task_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_task_time_spent
  AFTER INSERT OR UPDATE OR DELETE ON task_time_entries
  FOR EACH ROW EXECUTE FUNCTION sync_task_time_spent();

-- RLS Policies
ALTER TABLE task_time_entries ENABLE ROW LEVEL SECURITY;

-- Users can see all entries for tasks they are involved in
CREATE POLICY "time_entries_select"
  ON task_time_entries FOR SELECT
  TO authenticated
  USING (
    -- Own entries
    user_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
    OR
    -- Admin/manager can see all
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'director', 'manager')
    )
    OR
    -- Task members can see entries for their tasks
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
        AND (
          t.created_by = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
          OR (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1) = ANY(t.assignees)
          OR (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1) = ANY(COALESCE(t.watchers, '{}'))
        )
    )
  );

-- Users can insert their own entries
CREATE POLICY "time_entries_insert_own"
  ON task_time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- Users can update their own entries
CREATE POLICY "time_entries_update_own"
  ON task_time_entries FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND role = 'admin')
  );

-- Users can delete their own entries
CREATE POLICY "time_entries_delete_own"
  ON task_time_entries FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM employees WHERE auth_user_id = auth.uid() AND role = 'admin')
  );
