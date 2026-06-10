-- Khắc phục: lần chạy migration trước đã thêm dòng "Quỹ dự phòng chi phí chờ quyết toán"
-- vào details.executionCosts nhưng do điều kiện NOT EXISTS, estimated_cost (và do đó
-- admin_profit/rev_profit) của các hợp đồng đó CHƯA được cộng thêm 0.5% doanh thu này.
--
-- Migration này tính lại estimated_cost từ đầu (idempotent) cho mọi hợp đồng ký từ 2026
-- = tổng chi phí đầu vào (inputPrice*quantity + directCosts) của các lineItems
--   + tổng amount của executionCosts (đã bao gồm dòng Quỹ dự phòng).

WITH line_costs AS (
    SELECT
        c.id,
        COALESCE(SUM(
            (COALESCE((li->>'inputPrice')::numeric, 0) * COALESCE((li->>'quantity')::numeric, 1))
            + COALESCE((li->>'directCosts')::numeric, 0)
        ), 0) AS input_sum
    FROM public.contracts c
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(c.details->'lineItems', '[]'::jsonb)) AS li ON true
    WHERE EXTRACT(YEAR FROM c.signed_date) >= 2026
    GROUP BY c.id
),
exec_costs AS (
    SELECT
        c.id,
        COALESCE(SUM(COALESCE((ec->>'amount')::numeric, 0)), 0) AS exec_sum
    FROM public.contracts c
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(c.details->'executionCosts', '[]'::jsonb)) AS ec ON true
    WHERE EXTRACT(YEAR FROM c.signed_date) >= 2026
    GROUP BY c.id
)
UPDATE public.contracts c
SET estimated_cost = ROUND(line_costs.input_sum + exec_costs.exec_sum)
FROM line_costs, exec_costs
WHERE c.id = line_costs.id
  AND c.id = exec_costs.id
  AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(c.details->'executionCosts', '[]'::jsonb)) AS item
      WHERE item->>'id' = 'exec-reserve-fund-2026'
  );
