-- Migration: 20260610110000_analytics_unit_performance_card.sql
-- Description: Seed phân quyền cho card mới 'unit-performance' (Hiệu suất theo Đơn vị)
--   ở tab Hiệu suất & Khách hàng — bật cho tất cả role (general card).

DO $$
DECLARE
    all_roles TEXT[] := ARRAY['Admin','Leadership','UnitLeader','AdminUnit','NVKD','NVKT','Accountant','ChiefAccountant','Legal','Marketing'];
BEGIN
    INSERT INTO analytics_role_cards (role, card_id, enabled)
    SELECT r, 'unit-performance', true
    FROM unnest(all_roles) AS r
    ON CONFLICT (role, card_id) DO NOTHING;
END $$;
