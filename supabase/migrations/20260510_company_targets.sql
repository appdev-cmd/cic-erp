-- Company Targets: Chỉ tiêu ĐHCĐ (Đại hội cổ đông) cấp công ty theo năm
-- Tách riêng khỏi unit_targets vì đây là chỉ tiêu do ĐHCĐ phê duyệt,
-- khác với tổng chỉ tiêu nội bộ (= Σ unit_targets)

CREATE TABLE IF NOT EXISTS public.company_targets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    year INTEGER NOT NULL UNIQUE,
    signing NUMERIC DEFAULT 0,        -- Chỉ tiêu ký kết ĐHCĐ
    revenue NUMERIC DEFAULT 0,        -- Chỉ tiêu doanh thu ĐHCĐ
    admin_profit NUMERIC DEFAULT 0,   -- Chỉ tiêu LNG Quản trị ĐHCĐ
    rev_profit NUMERIC DEFAULT 0,     -- Chỉ tiêu LNG theo DT ĐHCĐ (= admin_profit)
    cash NUMERIC DEFAULT 0,           -- Chỉ tiêu dòng tiền ĐHCĐ
    notes TEXT,                        -- Ghi chú (VD: "Nghị quyết ĐHCĐ 2026")
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_targets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view
CREATE POLICY "company_targets_select" ON public.company_targets
    FOR SELECT TO authenticated USING (true);

-- Only app-layer checks Admin role for mutations
CREATE POLICY "company_targets_insert" ON public.company_targets
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "company_targets_update" ON public.company_targets
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "company_targets_delete" ON public.company_targets
    FOR DELETE TO authenticated USING (true);

-- Index for year lookup
CREATE INDEX IF NOT EXISTS idx_company_targets_year ON public.company_targets(year);
