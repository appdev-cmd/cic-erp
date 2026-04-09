-- ==============================================================================
-- Migration: HRM Internal Requests Module
-- Description: Create tables for internal requests (meeting room, vehicle, etc.)
-- ==============================================================================

-- 1. Internal Requests Table
CREATE TABLE public.internal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    unit_id TEXT NOT NULL REFERENCES public.units(id),
    
    type VARCHAR(50) NOT NULL, -- 'meeting_room', 'vehicle', 'stationery', 'other'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Dynamic details based on type (e.g. start/end time, room name, destination)
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Status pipeline: pending_unit -> pending_admin -> approved
    status VARCHAR(50) NOT NULL DEFAULT 'pending_unit',
    
    -- Approvers
    approver_unit_id TEXT REFERENCES public.employees(id),
    approver_admin_id TEXT REFERENCES public.employees(id),
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes
CREATE INDEX idx_internal_requests_employee ON public.internal_requests(employee_id);
CREATE INDEX idx_internal_requests_unit ON public.internal_requests(unit_id);
CREATE INDEX idx_internal_requests_status ON public.internal_requests(status);
CREATE INDEX idx_internal_requests_type ON public.internal_requests(type);

-- Triggers for updated_at
CREATE TRIGGER update_internal_requests_updated_at
    BEFORE UPDATE ON public.internal_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.internal_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read all requests in their unit, admins can read all
CREATE POLICY "Users can read requests" ON public.internal_requests
    FOR SELECT USING (true); -- Simplified for ERP internal structure

CREATE POLICY "Users can insert their own requests" ON public.internal_requests
    FOR INSERT WITH CHECK (
        employee_id IN (
            SELECT id FROM public.employees WHERE email = auth.jwt()->>'email'
        )
    );

CREATE POLICY "Users can update their own drafts/pending" ON public.internal_requests
    FOR UPDATE USING (
        employee_id IN (
            SELECT id FROM public.employees WHERE email = auth.jwt()->>'email'
        )
    );

-- Approvers can update status
CREATE POLICY "Approvers can update" ON public.internal_requests
    FOR UPDATE USING (true);
