-- =============================================================================
-- Fix v2: get_brands_with_stats — Sửa "column reference id is ambiguous"
-- Nguyên nhân: COUNT(id) trong CTE bị nhập nhằng với output column "id" của RETURN TABLE
-- Giải pháp: dùng prefix alias rõ ràng cho TẤT CẢ column trong tất cả CTE
-- Fix revenue: LUÔN dùng outputPrice × quantity (không dùng actual_revenue)
-- Fix contract value: DISTINCT để không double-count khi HĐ có nhiều SP cùng hãng
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_brands_with_stats(
    p_search  text    DEFAULT NULL,
    p_unit_id text    DEFAULT 'all',
    p_year    text    DEFAULT 'All',
    p_period  text    DEFAULT 'Toàn thời gian',
    p_limit   integer DEFAULT NULL,
    p_offset  integer DEFAULT NULL
)
RETURNS TABLE(
    id                   text,
    name                 text,
    code                 text,
    logo_url             text,
    website              text,
    country              text,
    description          text,
    is_active            boolean,
    created_at           timestamp with time zone,
    updated_at           timestamp with time zone,
    product_count        bigint,
    contract_count       bigint,
    total_contract_value numeric,
    total_revenue        numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_start_date DATE;
    v_end_date   DATE;
    v_year       INT := NULL;
    v_month      INT := NULL;
    v_quarter    INT := NULL;
BEGIN
    IF p_year IS NOT NULL AND p_year != 'All' THEN
        v_year := p_year::INTEGER;

        IF p_period = 'Cả năm' OR p_period = 'Toàn thời gian' OR p_period IS NULL THEN
            v_start_date := MAKE_DATE(v_year, 1,  1);
            v_end_date   := MAKE_DATE(v_year, 12, 31);
        ELSIF p_period ~ '^M[0-9]+$' THEN
            v_month      := substring(p_period FROM 2)::INTEGER;
            v_start_date := MAKE_DATE(v_year, v_month, 1);
            v_end_date   := (v_start_date + INTERVAL '1 month'  - INTERVAL '1 day')::DATE;
        ELSIF p_period ~ '^Q[1-4]$' THEN
            v_quarter    := substring(p_period FROM 2)::INTEGER;
            v_start_date := MAKE_DATE(v_year, (v_quarter - 1) * 3 + 1, 1);
            v_end_date   := (v_start_date + INTERVAL '3 months' - INTERVAL '1 day')::DATE;
        ELSIF p_period LIKE 'Quý %' THEN
            v_quarter    := CAST(REPLACE(p_period, 'Quý ', '') AS INTEGER);
            v_start_date := MAKE_DATE(v_year, (v_quarter - 1) * 3 + 1, 1);
            v_end_date   := (v_start_date + INTERVAL '3 months' - INTERVAL '1 day')::DATE;
        ELSIF p_period LIKE 'Tháng %' THEN
            v_month      := CAST(REPLACE(p_period, 'Tháng ', '') AS INTEGER);
            v_start_date := MAKE_DATE(v_year, v_month, 1);
            v_end_date   := (v_start_date + INTERVAL '1 month'  - INTERVAL '1 day')::DATE;
        ELSIF p_period = '6 tháng đầu năm' THEN
            v_start_date := MAKE_DATE(v_year, 1, 1);
            v_end_date   := MAKE_DATE(v_year, 6, 30);
        ELSIF p_period = '6 tháng cuối năm' THEN
            v_start_date := MAKE_DATE(v_year, 7, 1);
            v_end_date   := MAKE_DATE(v_year, 12, 31);
        ELSE
            v_start_date := MAKE_DATE(v_year, 1,  1);
            v_end_date   := MAKE_DATE(v_year, 12, 31);
        END IF;
    END IF;

    RETURN QUERY
    WITH
    -- Expand line items, join product → brand
    brand_line_items AS (
        SELECT
            prod.brand_id                                         AS bli_brand_id,
            cont.id                                               AS bli_contract_id,
            cont.value                                            AS bli_contract_value,
            -- ✅ LUÔN dùng outputPrice × quantity (không dùng actual_revenue)
            COALESCE(NULLIF(li->>'outputPrice', '')::numeric, 0)
                * COALESCE(NULLIF(li->>'quantity',  '')::numeric, 1) AS bli_item_revenue
        FROM contracts cont
        CROSS JOIN jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(cont.details->'lineItems') = 'array' THEN cont.details->'lineItems'
                WHEN jsonb_typeof(cont.line_items)           = 'array' THEN cont.line_items
                ELSE '[]'::jsonb
            END
        ) li
        JOIN products prod ON prod.id::text = (li->>'productId')
        WHERE cont.status IN ('Processing', 'Handover', 'Acceptance', 'Completed')
          AND (li->>'productId') IS NOT NULL
          AND (li->>'productId') != ''
          AND prod.brand_id IS NOT NULL
          AND (p_unit_id IS NULL OR p_unit_id = 'all' OR cont.unit_id = p_unit_id)
          AND (v_start_date IS NULL OR cont.signed_date >= v_start_date)
          AND (v_end_date   IS NULL OR cont.signed_date <= v_end_date)
    ),
    -- Tổng doanh thu theo hãng (sum line items)
    brand_revenue AS (
        SELECT
            bli.bli_brand_id                       AS br_brand_id,
            COUNT(DISTINCT bli.bli_contract_id)    AS br_contract_count,
            SUM(bli.bli_item_revenue)              AS br_total_revenue
        FROM brand_line_items bli
        GROUP BY bli.bli_brand_id
    ),
    -- Giá trị HĐ ký kết (mỗi HĐ chỉ đếm 1 lần dù có nhiều SP cùng hãng)
    brand_unique_contracts AS (
        SELECT DISTINCT
            bli.bli_brand_id       AS buc_brand_id,
            bli.bli_contract_id    AS buc_contract_id,
            bli.bli_contract_value AS buc_contract_value
        FROM brand_line_items bli
    ),
    brand_contract_value AS (
        SELECT
            buc.buc_brand_id            AS bcv_brand_id,
            SUM(buc.buc_contract_value) AS bcv_total_contract_value
        FROM brand_unique_contracts buc
        GROUP BY buc.buc_brand_id
    ),
    -- Đếm sản phẩm (dùng alias rõ ràng tránh "id is ambiguous")
    product_stats AS (
        SELECT
            prd.brand_id  AS ps_brand_id,
            COUNT(prd.id) AS ps_product_count   -- ✅ prd.id thay vì bare "id"
        FROM products prd
        WHERE prd.is_active = true
          AND prd.brand_id IS NOT NULL
        GROUP BY prd.brand_id
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
        COALESCE(ps.ps_product_count,         0)::bigint,
        COALESCE(br.br_contract_count,        0)::bigint,
        COALESCE(bcv.bcv_total_contract_value, 0)::numeric,
        COALESCE(br.br_total_revenue,         0)::numeric
    FROM brands b
    LEFT JOIN brand_revenue        br  ON b.id = br.br_brand_id
    LEFT JOIN brand_contract_value bcv ON b.id = bcv.bcv_brand_id
    LEFT JOIN product_stats        ps  ON b.id = ps.ps_brand_id
    WHERE (
        p_search IS NULL OR p_search = ''
        OR b.name    ILIKE '%' || p_search || '%'
        OR b.code    ILIKE '%' || p_search || '%'
        OR b.country ILIKE '%' || p_search || '%'
    )
    ORDER BY COALESCE(br.br_total_revenue, 0) DESC, b.name ASC
    LIMIT  p_limit
    OFFSET p_offset;
END;
$$;
