-- Bổ sung dòng chi phí "Quỹ dự phòng chi phí chờ quyết toán" (= 0.5% Doanh thu dự kiến)
-- vào executionCosts của tất cả hợp đồng ký từ năm 2026 trở đi (nếu chưa có),
-- đồng thời cập nhật lại estimated_cost để trigger tính lại admin_profit/rev_profit.

WITH calc AS (
    SELECT
        id,
        ROUND(COALESCE(expected_revenue, 0) * 0.005) AS reserve_amount
    FROM public.contracts
    WHERE EXTRACT(YEAR FROM signed_date) >= 2026
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(details->'executionCosts', '[]'::jsonb)) AS item
        WHERE item->>'id' = 'exec-reserve-fund-2026'
           OR item->>'name' = 'Quỹ dự phòng chi phí chờ quyết toán'
      )
)
UPDATE public.contracts c
SET
    details = jsonb_set(
        COALESCE(c.details, '{}'::jsonb),
        '{executionCosts}',
        COALESCE(c.details->'executionCosts', '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
                'id', 'exec-reserve-fund-2026',
                'name', 'Quỹ dự phòng chi phí chờ quyết toán',
                'percentage', 0.5,
                'amount', calc.reserve_amount
            )
        ),
        true
    ),
    estimated_cost = COALESCE(c.estimated_cost, 0) + calc.reserve_amount
FROM calc
WHERE c.id = calc.id;
