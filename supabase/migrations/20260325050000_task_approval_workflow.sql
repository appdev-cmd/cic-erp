-- =============================================
-- Task Approval Workflow — Phương án B
-- Adds approval columns to tasks table
-- =============================================

-- 1. Add approval columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_status text CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_mode text DEFAULT 'all' CHECK (approval_mode IN ('all', 'any'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_comment text;

-- 2. Index for fast lookup of approval subtasks
CREATE INDEX IF NOT EXISTS idx_tasks_approval_parent ON tasks (approval_parent_id) WHERE approval_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_approval_status ON tasks (approval_status) WHERE approval_status IS NOT NULL;

-- 3. Ensure "Chờ phê duyệt" status exists (use "Đang review" if already present, or insert new)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'Chờ phê duyệt' AND space_id IS NULL) THEN
    -- Check if "Đang review" exists and rename it
    IF EXISTS (SELECT 1 FROM task_statuses WHERE name = 'Đang review' AND space_id IS NULL) THEN
      UPDATE task_statuses SET name = 'Chờ phê duyệt', color = '#f59e0b' WHERE name = 'Đang review' AND space_id IS NULL;
    ELSE
      INSERT INTO task_statuses (name, color, sort_order, is_done, is_default)
      VALUES ('Chờ phê duyệt', '#f59e0b', 2, false, false);
    END IF;
  END IF;
END $$;
