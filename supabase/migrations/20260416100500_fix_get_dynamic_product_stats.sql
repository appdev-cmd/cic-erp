-- Cập nhật hàm get_dynamic_product_stats để tương thích với format chuỗi periodFilter từ UI (Q1, M1, ...)
CREATE OR REPLACE FUNCTION get_dynamic_product_stats(
    p_unit_id text DEFAULT 'all',
    p_year text DEFAULT 'All',
    p_period text DEFAULT 'Toàn thời gian',
    p_product_ids text[] DEFAULT '{}'
)
RETURNS TABLE (
    product_id text,
    total_contract_value numeric,
    total_revenue numeric
) AS $$
DECLARE
    v_start_date date;
    v_end_date date;
    v_year_int int;
    v_month int;
    v_quarter int;
BEGIN
    -- Determine dates based on period and year
    IF p_year IS NOT NULL AND p_year != 'All' THEN
        v_year_int := p_year::int;
        v_start_date := make_date(v_year_int, 1, 1);
        v_end_date := make_date(v_year_int, 12, 31);
        
        IF p_period IS NOT NULL AND p_period != 'Toàn thời gian' THEN
            -- Hỗ trợ format chuẩn M1..M12
            IF substring(p_period from 1 for 1) = 'M' THEN
                v_month := substring(p_period from 2)::INTEGER;
                v_start_date := make_date(v_year_int, v_month, 1);
                v_end_date := (v_start_date + interval '1 month' - interval '1 day')::DATE;
            -- Hỗ trợ format chuẩn Q1..Q4
            ELSIF substring(p_period from 1 for 1) = 'Q' AND substring(p_period from 2) ~ '^[0-9]+$' THEN
                v_quarter := substring(p_period from 2)::INTEGER;
                v_month := (v_quarter - 1) * 3 + 1;
                v_start_date := make_date(v_year_int, v_month, 1);
                v_end_date := (v_start_date + interval '3 months' - interval '1 day')::DATE;
            -- Hỗ trợ fallback (nếu vẫn truyền Tiếng Việt dạng Quý 1, Quý 2)
            ELSIF p_period = 'Quý 1' THEN
                v_start_date := make_date(v_year_int, 1, 1);
                v_end_date := make_date(v_year_int, 3, 31);
            ELSIF p_period = 'Quý 2' THEN
                v_start_date := make_date(v_year_int, 4, 1);
                v_end_date := make_date(v_year_int, 6, 30);
            ELSIF p_period = 'Quý 3' THEN
                v_start_date := make_date(v_year_int, 7, 1);
                v_end_date := make_date(v_year_int, 9, 30);
            ELSIF p_period = 'Quý 4' THEN
                v_start_date := make_date(v_year_int, 10, 1);
                v_end_date := make_date(v_year_int, 12, 31);
            ELSIF p_period = '6 tháng đầu năm' THEN
                v_start_date := make_date(v_year_int, 1, 1);
                v_end_date := make_date(v_year_int, 6, 30);
            ELSIF p_period = '6 tháng cuối năm' THEN
                v_start_date := make_date(v_year_int, 7, 1);
                v_end_date := make_date(v_year_int, 12, 31);
            END IF;
        END IF;
    END IF;

    RETURN QUERY
    WITH product_contracts AS (
        SELECT DISTINCT
            c.id as contract_id,
            (item->>'productId') as prod_id,
            c.value as contract_value,
            c.actual_revenue as actual_revenue
        FROM contracts c,
        jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(c.details->'lineItems') = 'array' THEN c.details->'lineItems'
                WHEN jsonb_typeof(c.line_items) = 'array' THEN c.line_items
                ELSE '[]'::jsonb
            END
        ) as item
        WHERE c.status IN ('Processing', 'Handover', 'Acceptance', 'Completed') 
          AND item->>'productId' IS NOT NULL
          AND item->>'productId' != ''
          -- Filter by allowed products if provided
          AND (array_length(p_product_ids, 1) IS NULL OR (item->>'productId') = ANY(p_product_ids))
          -- Filter by unit
          AND (p_unit_id = 'all' OR c.unit_id = p_unit_id)
          -- Filter by date timeframe
          AND (v_start_date IS NULL OR c.signed_date >= v_start_date)
          AND (v_end_date IS NULL OR c.signed_date <= v_end_date)
    )
    SELECT 
        pc.prod_id as product_id,
        SUM(pc.contract_value) as total_contract_value,
        SUM(pc.actual_revenue) as total_revenue
    FROM product_contracts pc
    GROUP BY pc.prod_id;
END;
$$ LANGUAGE plpgsql;
