CREATE OR REPLACE FUNCTION get_brands_with_stats(
    p_unit_id text DEFAULT 'all',
    p_year text DEFAULT 'All',
    p_period text DEFAULT 'Toàn thời gian'
)
RETURNS TABLE (
    id uuid,
    name text,
    code text,
    country text,
    website text,
    description text,
    is_active boolean,
    total_contract_value numeric,
    total_revenue numeric,
    product_count bigint
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
            -- Format M1..M12
            IF substring(p_period from 1 for 1) = 'M' THEN
                v_month := substring(p_period from 2)::INTEGER;
                v_start_date := make_date(v_year_int, v_month, 1);
                v_end_date := (v_start_date + interval '1 month' - interval '1 day')::DATE;
            -- Format Q1..Q4
            ELSIF substring(p_period from 1 for 1) = 'Q' AND substring(p_period from 2) ~ '^[0-9]+$' THEN
                v_quarter := substring(p_period from 2)::INTEGER;
                v_month := (v_quarter - 1) * 3 + 1;
                v_start_date := make_date(v_year_int, v_month, 1);
                v_end_date := (v_start_date + interval '3 months' - interval '1 day')::DATE;
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
            (item->>'productId') as product_id,
            c.value as contract_value,
            c.actual_revenue as actual_revenue,
            c.unit_id,
            c.signed_date
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
    filtered_contracts AS (
        SELECT pc.*, p.brand_id
        FROM product_contracts pc
        JOIN products p ON p.id::text = pc.product_id
        WHERE (p_unit_id = 'all' OR pc.unit_id = p_unit_id)
          AND (v_start_date IS NULL OR pc.signed_date >= v_start_date)
          AND (v_end_date IS NULL OR pc.signed_date <= v_end_date)
          AND p.brand_id IS NOT NULL
    ),
    brand_stats AS (
        SELECT 
            brand_id,
            SUM(contract_value) as total_contract_value,
            SUM(actual_revenue) as total_revenue
        FROM filtered_contracts
        GROUP BY brand_id
    )
    SELECT 
        b.id,
        b.name,
        b.code,
        b.country,
        b.website,
        b.description,
        b.is_active,
        COALESCE(bs.total_contract_value, 0)::numeric,
        COALESCE(bs.total_revenue, 0)::numeric,
        (SELECT count(*) FROM products p WHERE p.brand_id = b.id)::bigint as product_count
    FROM brands b
    LEFT JOIN brand_stats bs ON b.id = bs.brand_id
    ORDER BY b.name;
END;
$$ LANGUAGE plpgsql;
