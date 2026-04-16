CREATE OR REPLACE FUNCTION public.get_brands_with_stats(
    p_search text DEFAULT NULL::text, 
    p_unit_id text DEFAULT 'all'::text, 
    p_year text DEFAULT 'All'::text, 
    p_period text DEFAULT 'Toàn thời gian'::text, 
    p_limit integer DEFAULT NULL::integer, 
    p_offset integer DEFAULT NULL::integer
)
RETURNS TABLE(
    id text, 
    name text, 
    code text, 
    logo_url text, 
    website text, 
    country text, 
    description text, 
    is_active boolean, 
    created_at timestamp with time zone, 
    updated_at timestamp with time zone, 
    product_count bigint, 
    contract_count bigint, 
    total_contract_value numeric,
    total_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_year INT := NULL;
    v_month INT := NULL;
    v_quarter INT := NULL;
BEGIN
    -- Parse Year
    IF p_year IS NOT NULL AND p_year != 'All' THEN
        v_year := p_year::INTEGER;
    END IF;

    -- Parse Period to get Date Range
    IF v_year IS NOT NULL THEN
        IF p_period = 'Cả năm' OR p_period = 'Toàn thời gian' THEN
            v_start_date := MAKE_DATE(v_year, 1, 1);
            v_end_date := MAKE_DATE(v_year, 12, 31);
        ELSIF substring(p_period from 1 for 1) = 'M' THEN
            v_month := substring(p_period from 2)::INTEGER;
            v_start_date := make_date(v_year, v_month, 1);
            v_end_date := (v_start_date + interval '1 month' - interval '1 day')::DATE;
        ELSIF substring(p_period from 1 for 1) = 'Q' AND substring(p_period from 2) ~ '^[0-9]+$' THEN
            v_quarter := substring(p_period from 2)::INTEGER;
            v_month := (v_quarter - 1) * 3 + 1;
            v_start_date := make_date(v_year, v_month, 1);
            v_end_date := (v_start_date + interval '3 months' - interval '1 day')::DATE;
        ELSIF p_period LIKE 'Tháng %' THEN
            v_month := CAST(REPLACE(p_period, 'Tháng ', '') AS INTEGER);
            v_start_date := MAKE_DATE(v_year, v_month, 1);
            v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
        ELSIF p_period LIKE 'Quý %' THEN
            v_quarter := CAST(REPLACE(p_period, 'Quý ', '') AS INTEGER);
            v_start_date := MAKE_DATE(v_year, (v_quarter - 1) * 3 + 1, 1);
            v_end_date := (v_start_date + INTERVAL '3 months' - INTERVAL '1 day')::DATE;
        ELSE 
            v_start_date := MAKE_DATE(v_year, 1, 1);
            v_end_date := MAKE_DATE(v_year, 12, 31);
        END IF;
    END IF;

    RETURN QUERY
    WITH contract_items AS (
        SELECT 
            c.id as contract_id,
            (li->>'productId')::text as product_id,
            (li->>'outputPrice')::numeric as output_price,
            (li->>'quantity')::numeric as quantity,
            c.value as contract_value,
            c.actual_revenue as actual_revenue,
            c.unit_id,
            c.signed_date
        FROM 
            contracts c,
            jsonb_array_elements(
                CASE 
                    WHEN jsonb_typeof(c.details->'lineItems') = 'array' THEN c.details->'lineItems'
                    WHEN jsonb_typeof(c.line_items) = 'array' THEN c.line_items
                    ELSE '[]'::jsonb
                END
            ) li
        WHERE
            c.status IN ('Processing', 'Handover', 'Acceptance', 'Completed')
            AND (li->>'productId') IS NOT NULL
            AND (p_unit_id IS NULL OR p_unit_id = 'all' OR c.unit_id = p_unit_id)
            AND (v_start_date IS NULL OR (
                c.signed_date >= v_start_date AND c.signed_date <= v_end_date
            ))
    ),
    brand_stats AS (
        SELECT 
            p.brand_id,
            COUNT(DISTINCT ci.contract_id) as contract_count,
            COALESCE(SUM(ci.contract_value), 0) as total_contract_value,
            COALESCE(SUM(ci.actual_revenue), COALESCE(SUM(ci.output_price * ci.quantity), 0)) as total_revenue
        FROM 
            contract_items ci
        JOIN 
            products p ON p.id::text = ci.product_id
        WHERE 
            p.brand_id IS NOT NULL
        GROUP BY 
            p.brand_id
    ),
    product_stats AS (
        SELECT 
            brand_id,
            COUNT(products.id) as product_count
        FROM 
            products
        WHERE 
            products.is_active = true
            AND products.brand_id IS NOT NULL
        GROUP BY 
            products.brand_id
    )
    SELECT 
        b.id::TEXT,
        b.name,
        b.code,
        b.logo_url,
        b.website,
        b.country,
        b.description,
        b.is_active,
        b.created_at,
        b.updated_at,
        
        COALESCE(ps.product_count, 0) as product_count,
        COALESCE(bs.contract_count, 0) as contract_count,
        COALESCE(bs.total_contract_value, 0) as total_contract_value,
        COALESCE(bs.total_revenue, 0) as total_revenue
    FROM 
        brands b
    LEFT JOIN 
        brand_stats bs ON b.id = bs.brand_id
    LEFT JOIN 
        product_stats ps ON b.id = ps.brand_id
    WHERE 
        (p_search IS NULL OR p_search = '' OR 
         CASE WHEN current_setting('server_version_num')::int >= 130000 THEN 
                b.name ILIKE '%' || p_search || '%' OR 
                b.code ILIKE '%' || p_search || '%' OR 
                b.country ILIKE '%' || p_search || '%'
              ELSE 
                b.name ILIKE '%' || p_search || '%' OR 
                b.code ILIKE '%' || p_search || '%' OR 
                b.country ILIKE '%' || p_search || '%'
         END
        )
    ORDER BY 
        -- Optimization: Sort by revenue primarily so top value brands are always first when filtering
        COALESCE(bs.total_revenue, 0) DESC,
        b.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$;
