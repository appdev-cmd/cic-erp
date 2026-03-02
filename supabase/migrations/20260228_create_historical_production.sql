-- Migration: historical_production table
-- Stores year-over-year production data per unit for comparison

CREATE TABLE IF NOT EXISTS historical_production (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    signing NUMERIC DEFAULT 0,          -- Ký kết (triệu đồng)
    revenue NUMERIC DEFAULT 0,          -- Doanh thu thực hiện (triệu đồng)
    admin_profit NUMERIC DEFAULT 0,     -- LNG Quản trị (triệu đồng)
    rev_profit NUMERIC DEFAULT 0,       -- LNG theo Doanh thu (triệu đồng)
    notes TEXT,
    updated_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(unit_id, year)
);

-- RLS
ALTER TABLE historical_production ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historical_production_dev_access" ON historical_production
    FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX idx_historical_production_unit_year ON historical_production(unit_id, year);

-- ============================================================
-- SEED DATA from user-provided production reports (2023–2025)
-- Values are in triệu đồng (millions VND)
-- ============================================================

INSERT INTO historical_production (unit_id, year, signing, revenue, admin_profit, rev_profit)
VALUES
    -- 2023
    ('pmxd', 2023, 3350, 2769, 1979, 1969),
    ('dcs',  2023, 46834, 40828, 5740, 8490),
    ('hcm',  2023, 36470, 35434, 6809, 6925),
    ('stc',  2023, 29335, 26925, 3913, 4216),
    ('tvda', 2023, 623, 650, 223, 311),
    ('tvtk', 2023, 0, 474, 399, 399),
    ('css',  2023, 981, 1077, 368, 426),
    ('bim',  2023, 21163, 8802, 4426, 2792),

    -- 2024
    ('pmxd', 2024, 3817, 3007, 1558, 1468),
    ('dcs',  2024, 54112, 53630, 9452, 10088),
    ('hcm',  2024, 53493, 52960, 8878, 9078),
    ('stc',  2024, 28621, 18266, 3421, 3824),
    ('tvda', 2024, 2963, 2029, 977, 1002),
    ('tvtk', 2024, 0, 442, 0, 442),
    ('css',  2024, 3513, 997, 753, 178),
    ('bim',  2024, 21834, 8401, 7642, 3479),

    -- 2025
    ('pmxd', 2025, 2244, 2096, 1273, 1273),
    ('dcs',  2025, 79694, 81713, 20421, 19881),
    ('hcm',  2025, 80250, 78494, 14219, 14254),
    ('stc',  2025, 44301, 44422, 5865, 5690),
    ('tvda', 2025, 2167, 877, 443, 600),
    ('tvtk', 2025, 1531, 1848, 1294, 1294),
    ('css',  2025, 4309, 3637, 1298, 1274),
    ('bim',  2025, 0, 0, 994, 0)
ON CONFLICT (unit_id, year) DO UPDATE SET
    signing = EXCLUDED.signing,
    revenue = EXCLUDED.revenue,
    admin_profit = EXCLUDED.admin_profit,
    rev_profit = EXCLUDED.rev_profit,
    updated_at = now();
