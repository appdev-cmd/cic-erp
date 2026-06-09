-- Migration: 20260609130000_analytics_more_cards.sql
-- Description: Seed phân quyền cho 14 card mới của phân hệ Phân tích kinh doanh
--   (bổ sung sau 20260609120000_analytics_card_config.sql).
--   - general cards → bật cho TẤT CẢ role.
--   - profit cards  → chỉ bật cho Admin/Leadership/ChiefAccountant/Accountant.
-- Card mới sẽ KHÔNG hiển thị với role thường nếu role đó đã có cấu hình DB trước đó
-- (vì hook lấy đúng tập card_id của role), nên phải seed các id mới tại đây.

DO $$
DECLARE
    all_roles TEXT[] := ARRAY['Admin','Leadership','UnitLeader','AdminUnit','NVKD','NVKT','Accountant','ChiefAccountant','Legal','Marketing'];
    finance_roles TEXT[] := ARRAY['Admin','Leadership','ChiefAccountant','Accountant'];
    general_cards TEXT[] := ARRAY[
        'contract-status-funnel','contract-classification','cumulative-vs-target',
        'cumulative-cashflow','ar-aging','top-receivables','collection-rate-trend',
        'revenue-pareto',
        'employee-target-completion','new-vs-returning-customers','deal-size-distribution','cycle-time'
    ];
    profit_cards TEXT[] := ARRAY['kpi-summary','brand-bcg'];
BEGIN
    INSERT INTO analytics_role_cards (role, card_id, enabled)
    SELECT r, c, true
    FROM unnest(all_roles) AS r
    CROSS JOIN unnest(general_cards) AS c
    ON CONFLICT (role, card_id) DO NOTHING;

    INSERT INTO analytics_role_cards (role, card_id, enabled)
    SELECT r, c, (r = ANY(finance_roles))
    FROM unnest(all_roles) AS r
    CROSS JOIN unnest(profit_cards) AS c
    ON CONFLICT (role, card_id) DO NOTHING;
END $$;
