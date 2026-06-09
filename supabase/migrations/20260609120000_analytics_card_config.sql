-- Migration: 20260609120000_analytics_card_config.sql
-- Description: Phân quyền & cá nhân hoá phân hệ Phân tích kinh doanh (BI).
--   1) analytics_role_cards       — Admin cấu hình card nào MỖI ROLE được phép xem.
--   2) user_dashboard_preferences — Mỗi USER tự chọn hiển thị & sắp xếp card (hybrid: DB + cache local).
-- Quy ước: user_id = EMPLOYEE ID (nhất quán với user_permissions / cross_unit_visibility).

-- ═══════════════════════════════════════════════════════════
-- 1. analytics_role_cards (Admin → role → card)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analytics_role_cards (
    role       TEXT NOT NULL,
    card_id    TEXT NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT true,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (role, card_id)
);

ALTER TABLE analytics_role_cards ENABLE ROW LEVEL SECURITY;

-- Đọc: mọi user đã đăng nhập (để client biết role mình được xem card nào).
DROP POLICY IF EXISTS "AnalyticsRoleCards_read" ON analytics_role_cards;
CREATE POLICY "AnalyticsRoleCards_read" ON analytics_role_cards
    FOR SELECT USING (auth.role() = 'authenticated');

-- Ghi: chỉ Admin (theo profiles.role). DEV fallback: cho phép authenticated nếu chưa có bảng profiles.
DROP POLICY IF EXISTS "AnalyticsRoleCards_admin_write" ON analytics_role_cards;
CREATE POLICY "AnalyticsRoleCards_admin_write" ON analytics_role_cards
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin')
    );

-- ═══════════════════════════════════════════════════════════
-- 2. user_dashboard_preferences (User → layout)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
    user_id    TEXT NOT NULL,
    module     TEXT NOT NULL DEFAULT 'analytics',
    config     JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, module)
);

ALTER TABLE user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Mỗi user đọc/ghi bản ghi của chính mình (so khớp employee_id qua profiles), Admin xem tất cả.
-- DEV mode: cho phép mọi authenticated (đồng bộ với chính sách user_permissions hiện tại).
DROP POLICY IF EXISTS "Dev_Allow_All_UserDashboardPrefs" ON user_dashboard_preferences;
CREATE POLICY "Dev_Allow_All_UserDashboardPrefs" ON user_dashboard_preferences
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_user_dashboard_prefs_user ON user_dashboard_preferences(user_id);

-- ═══════════════════════════════════════════════════════════
-- 3. Seed mặc định analytics_role_cards
--    - Card "general": bật cho TẤT CẢ role.
--    - Card "profit/sensitive" (lợi nhuận, biên LN, lịch sử LNG): chỉ bật cho
--      Admin / Leadership / ChiefAccountant / Accountant; các role khác = tắt.
-- ═══════════════════════════════════════════════════════════
DO $$
DECLARE
    all_roles TEXT[] := ARRAY['Admin','Leadership','UnitLeader','AdminUnit','NVKD','NVKT','Accountant','ChiefAccountant','Legal','Marketing'];
    finance_roles TEXT[] := ARRAY['Admin','Leadership','ChiefAccountant','Accountant'];
    general_cards TEXT[] := ARRAY['revenue-structure','plan-vs-actual','monthly-trend','cashflow','payment-status','top-brands','product-category','product-qty','brand-qty','top-customers','top-employees'];
    profit_cards  TEXT[] := ARRAY['brand-margin','brand-profit-structure','historical-yoy'];
BEGIN
    -- General cards → enabled = true cho mọi role
    INSERT INTO analytics_role_cards (role, card_id, enabled)
    SELECT r, c, true
    FROM unnest(all_roles) AS r
    CROSS JOIN unnest(general_cards) AS c
    ON CONFLICT (role, card_id) DO NOTHING;

    -- Profit-sensitive cards → enabled chỉ với finance/leadership
    INSERT INTO analytics_role_cards (role, card_id, enabled)
    SELECT r, c, (r = ANY(finance_roles))
    FROM unnest(all_roles) AS r
    CROSS JOIN unnest(profit_cards) AS c
    ON CONFLICT (role, card_id) DO NOTHING;
END $$;
