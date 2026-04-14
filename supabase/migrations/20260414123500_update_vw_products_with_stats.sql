-- Migration file for Product Stats
DROP VIEW IF EXISTS vw_products_with_stats CASCADE;

CREATE VIEW vw_products_with_stats AS
WITH product_contracts AS (
    SELECT DISTINCT
        c.id as contract_id,
        (item->>'productId') as product_id,
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
),
product_stats AS (
    SELECT 
        product_id,
        SUM(contract_value) as total_contract_value,
        SUM(actual_revenue) as total_revenue
    FROM product_contracts
    GROUP BY product_id
)
SELECT 
    p.*,
    b.name as brand_name,
    s.short_name as supplier_name,
    COALESCE(ps.total_contract_value, 0) as total_contract_value,
    COALESCE(ps.total_revenue, 0) as total_revenue
FROM products p
LEFT JOIN brands b ON p.brand_id = b.id
LEFT JOIN customers s ON p.supplier_id = s.id
LEFT JOIN product_stats ps ON p.id::text = ps.product_id;

-- Create dynamic stats RPC for frontend filters
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
BEGIN
    -- Determine dates based on period and year
    IF p_year != 'All' THEN
        v_year_int := p_year::int;
        IF p_period = 'Quý 1' THEN
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
        ELSE
            -- Cả năm hoặc Toàn thời gian with specific year
            v_start_date := make_date(v_year_int, 1, 1);
            v_end_date := make_date(v_year_int, 12, 31);
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
