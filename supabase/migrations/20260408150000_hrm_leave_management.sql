-- ============================================================
-- HRM Module — Leave Management
-- Phase 1: Nghỉ phép (Leave Policies, Balances, Requests)
-- ============================================================

-- ── Bảng 1: Chính sách nghỉ phép ──
CREATE TABLE IF NOT EXISTS leave_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_type VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100) NOT NULL,
    default_days NUMERIC(5,1) NOT NULL DEFAULT 12,
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    requires_document BOOLEAN NOT NULL DEFAULT false,
    paid BOOLEAN NOT NULL DEFAULT true,
    max_consecutive_days INTEGER,
    color VARCHAR(20) NOT NULL DEFAULT 'blue',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Bảng 2: Số phép còn lại theo năm ──
CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    leave_type VARCHAR(50) NOT NULL REFERENCES leave_policies(leave_type),
    total_days NUMERIC(5,1) NOT NULL DEFAULT 12,
    used_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    pending_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    carry_over NUMERIC(5,1) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(employee_id, year, leave_type)
);

-- ── Bảng 3: Đơn xin nghỉ phép ──
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) NOT NULL REFERENCES leave_policies(leave_type),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_half VARCHAR(10), -- 'morning' | 'afternoon' | null (full day)
    end_half VARCHAR(10),   -- 'morning' | 'afternoon' | null (full day)
    total_days NUMERIC(5,1) NOT NULL DEFAULT 1,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    approver_id UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    attachment_url TEXT,
    unit_id UUID REFERENCES units(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT leave_requests_status_check CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
    CONSTRAINT leave_requests_date_check CHECK (end_date >= start_date),
    CONSTRAINT leave_requests_half_check CHECK (
        start_half IS NULL OR start_half IN ('morning', 'afternoon')
    ),
    CONSTRAINT leave_requests_end_half_check CHECK (
        end_half IS NULL OR end_half IN ('morning', 'afternoon')
    )
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_unit ON leave_requests(unit_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- ── Trigger: Auto-update updated_at ──
CREATE OR REPLACE FUNCTION update_leave_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leave_balances_updated_at
    BEFORE UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_leave_updated_at();

CREATE TRIGGER leave_requests_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_leave_updated_at();

-- ── Seed: Chính sách nghỉ phép mặc định ──
INSERT INTO leave_policies (leave_type, label, default_days, requires_approval, requires_document, paid, max_consecutive_days, color) VALUES
    ('annual',      'Phép năm',              12,   true,  false, true,  NULL, 'blue'),
    ('sick',        'Nghỉ ốm',              30,   true,  true,  true,  30,   'red'),
    ('unpaid',      'Nghỉ không lương',       0,   true,  false, false, NULL, 'slate'),
    ('maternity',   'Thai sản',             180,   true,  true,  true,  180,  'pink'),
    ('paternity',   'Nghỉ chăm con (cha)',    5,   true,  true,  true,  7,    'cyan'),
    ('wedding',     'Nghỉ cưới',              3,   true,  false, true,  3,    'amber'),
    ('bereavement', 'Nghỉ tang',              3,   true,  false, true,  3,    'purple'),
    ('other',       'Nghỉ khác',              0,   true,  false, false, NULL, 'emerald')
ON CONFLICT (leave_type) DO NOTHING;

-- ── RLS (disable for now — control at app layer per PHANQUYENHETHONG.md) ──
ALTER TABLE leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access (actual permission check at app level)
CREATE POLICY "Allow authenticated access" ON leave_policies FOR ALL USING (true);
CREATE POLICY "Allow authenticated access" ON leave_balances FOR ALL USING (true);
CREATE POLICY "Allow authenticated access" ON leave_requests FOR ALL USING (true);
