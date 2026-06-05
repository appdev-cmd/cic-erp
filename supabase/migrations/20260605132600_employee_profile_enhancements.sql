-- Migration: 20260605132600_employee_profile_enhancements.sql
-- Description: Nâng cấp Hồ sơ CBNV: Thêm cột Quê quán (hometown), Trạng thái (status) và bảng Lộ trình (employee_timeline).

-- 1. Thêm cột vào bảng employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS hometown TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 2. Tạo bảng employee_timeline
CREATE TABLE IF NOT EXISTS public.employee_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'promotion', 'reward', 'discipline', 'salary_change', 'other'
    title TEXT NOT NULL,
    decision_number TEXT,
    effective_date DATE NOT NULL,
    description TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Đảm bảo bảng employee_documents tồn tại
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    doc_type TEXT NOT NULL DEFAULT 'other', -- 'certificate', 'degree', 'contract', 'id_card', 'other'
    description TEXT,
    url TEXT NOT NULL,
    issued_date DATE,
    expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Bật Row Level Security (RLS)
ALTER TABLE public.employee_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- 5. Tạo các chính sách RLS an toàn (phù hợp với môi trường dev hiện tại của dự án)
DROP POLICY IF EXISTS "Allow authenticated access to employee_timeline" ON public.employee_timeline;
CREATE POLICY "Allow authenticated access to employee_timeline"
    ON public.employee_timeline
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated access to employee_documents" ON public.employee_documents;
CREATE POLICY "Allow authenticated access to employee_documents"
    ON public.employee_documents
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. Trigger tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_employee_timeline_updated_at ON public.employee_timeline;
CREATE TRIGGER set_employee_timeline_updated_at
    BEFORE UPDATE ON public.employee_timeline
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS set_employee_documents_updated_at ON public.employee_documents;
CREATE TRIGGER set_employee_documents_updated_at
    BEFORE UPDATE ON public.employee_documents
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
