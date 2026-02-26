-- Migration: 20260226_create_cross_unit_visibility.sql
-- Description: Cross-unit data visibility permissions.
-- Allows admins to grant employees access to view contracts/production data of other units.

CREATE TABLE IF NOT EXISTS cross_unit_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL,          -- References employees.id
    allowed_unit_id TEXT NOT NULL,      -- References units.id
    granted_by TEXT,                    -- Who granted this permission
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id, allowed_unit_id)
);

-- Enable RLS (DEV mode: allow all access, matching units/contracts tables)
ALTER TABLE cross_unit_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dev_Allow_All_CrossUnitVisibility" ON cross_unit_visibility;
CREATE POLICY "Dev_Allow_All_CrossUnitVisibility" ON cross_unit_visibility
    FOR ALL USING (true)
    WITH CHECK (true);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_cross_unit_visibility_employee ON cross_unit_visibility(employee_id);
CREATE INDEX IF NOT EXISTS idx_cross_unit_visibility_unit ON cross_unit_visibility(allowed_unit_id);
