-- Migration: Create project members table
-- Created at: 2026-04-20

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, employee_id)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_employee_id ON project_members(employee_id);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can view all project members
CREATE POLICY "project_members_select_all" ON project_members
  FOR SELECT TO authenticated
  USING (true);

-- Policy: authenticated users can insert project members
CREATE POLICY "project_members_insert_auth" ON project_members
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Policy: authenticated users can update project members
CREATE POLICY "project_members_update_auth" ON project_members
  FOR UPDATE TO authenticated
  USING (true);

-- Policy: authenticated users can delete project members
CREATE POLICY "project_members_delete_auth" ON project_members
  FOR DELETE TO authenticated
  USING (true);
