-- Migration: Enable RLS and AI Audit Logging
-- Phục vụ cho kiến trúc AI Agent phân quyền tập trung

-- 1. Create AI Tool Audit Logs table
CREATE TABLE IF NOT EXISTS public.ai_tool_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    tool_name text NOT NULL,
    args jsonb,
    unit_scope text[] DEFAULT '{}',
    result text NOT NULL,
    data_accessed text,
    created_at timestamp with time zone DEFAULT now()
);

-- Index for searching audit logs
CREATE INDEX IF NOT EXISTS idx_ai_tool_audit_logs_user_id ON public.ai_tool_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_audit_logs_created_at ON public.ai_tool_audit_logs(created_at);

-- 2. ENABLING RLS FOR REAL (Replacing Dev Permissive Mode)

-- CONTRACTS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Drop permissive dev policy if exists
DROP POLICY IF EXISTS "Dev_Allow_All_Contracts" ON public.contracts;

-- Policy 1: Admin, Leadership, Kế toán, Legal, Marketing -> Thấy mọi HĐ
CREATE POLICY "Global View Contracts" ON public.contracts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('Admin', 'Leadership', 'Accountant', 'ChiefAccountant', 'Legal', 'Marketing')
    )
);

-- Policy 2: NVKD, NVKT, AdminUnit, UnitLeader -> Thấy HĐ của phòng mình (hoặc phòng được cấp quyền cross_unit)
CREATE POLICY "Unit View Contracts" ON public.contracts
FOR SELECT
USING (
    unit_id IN (
        SELECT unit_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT target_unit_id FROM public.cross_unit_visibility WHERE user_id = auth.uid()
    )
);

-- PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dev_Allow_All_Payments" ON public.payments;

-- Policy 1: Global View Payments
CREATE POLICY "Global View Payments" ON public.payments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('Admin', 'Leadership', 'Accountant', 'ChiefAccountant', 'Legal')
    )
);

-- Policy 2: Unit View Payments (qua contracts)
CREATE POLICY "Unit View Payments" ON public.payments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.id = payments.contract_id
        AND c.unit_id IN (
            SELECT unit_id FROM public.profiles WHERE id = auth.uid()
            UNION
            SELECT target_unit_id FROM public.cross_unit_visibility WHERE user_id = auth.uid()
        )
    )
);

-- CUSTOMERS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Assuming permissive didn't explicitly target customers, but let's drop if it did
DROP POLICY IF EXISTS "Dev_Allow_All_Customers" ON public.customers;

-- Policy 1: Global View Customers
CREATE POLICY "Global View Customers" ON public.customers
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('Admin', 'Leadership', 'Accountant', 'ChiefAccountant', 'Legal', 'Marketing')
    )
);

-- Policy 2: Unit View Customers (Customers created by this unit or have contracts with this unit)
CREATE POLICY "Unit View Customers" ON public.customers
FOR SELECT
USING (
    unit_id IN (
        SELECT unit_id FROM public.profiles WHERE id = auth.uid()
        UNION
        SELECT target_unit_id FROM public.cross_unit_visibility WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.contracts c
        WHERE c.customer_id = customers.id
        AND c.unit_id IN (
            SELECT unit_id FROM public.profiles WHERE id = auth.uid()
            UNION
            SELECT target_unit_id FROM public.cross_unit_visibility WHERE user_id = auth.uid()
        )
    )
);
