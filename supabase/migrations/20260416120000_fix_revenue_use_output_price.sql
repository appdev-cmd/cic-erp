-- Fix: tính total_revenue dùng outputPrice × quantity từ line item
-- thay vì actual_revenue của hợp đồng (tránh double-counting).
-- total_contract_value giữ nguyên = SUM(c.value) để phản ánh tổng giá trị HĐ chứa sản phẩm này.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. VIEW: vw_products_with_stats
-- ─────────────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_products_with_stats CASCADE;

CREATE VIEW vw_products_with_stats AS
WITH product_line_items AS (
    SELECT
        c.id   AS contract_id,
        (item->>'productId') AS product_id,
        c.value AS contract_value,
        -- Revenue attributed directly to this line item (outputPrice × quantity)
        COALESCE(NULLIF(item->>'outputPrice','')::numeric, 0)
            * COALESCE(NULLIF(item->>'quantity','')::numeric, 1) AS item_revenue
    FROM contracts c,
    jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(c.details->'lineItems') = 'array' THEN c.details->'lineItems'
            WHEN jsonb_typeof(c.line_items)           = 'array' THEN c.line_items
            ELSE '[]'::jsonb
        END
    ) AS item
    WHERE c.status IN ('Processing', 'Handover', 'Acceptance', 'Completed')
      AND item->>'productId' IS NOT NULL
      AND item->>'productId' != ''
),
product_stats AS (
    SELECT
        product_id,
        SUM(contract_value) AS total_contract_value,   -- tổng giá trị HĐ (contract-level)
        SUM(item_revenue)   AS total_revenue            -- doanh thu sản phẩm (outputPrice×qty)
    FROM product_line_items
    GROUP BY product_id
)
SELECT
    p.*,
    b.name          AS brand_name,
    s.short_name    AS supplier_name,
    COALESCE(ps.total_contract_value, 0) AS total_contract_value,
    COALESCE(ps.total_revenue,        0) AS total_revenue
FROM products p
LEFT JOIN brands   b ON p.brand_id    = b.id
LEFT JOIN customers s ON p.supplier_id = s.id
LEFT JOIN product_stats ps ON p.id::text = ps.product_id;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNCTION: get_dynamic_product_stats  (filter theo unit / year / period)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dynamic_product_stats(
    p_unit_id    text    DEFAULT 'all',
    p_year       text    DEFAULT 'All',
    p_period     text    DEFAULT 'Toàn thời gian',
    p_product_ids text[] DEFAULT '{}'
)
RETURNS TABLE (
    product_id          text,
    total_contract_value numeric,
    total_revenue        numeric
) AS $$
DECLARE
    v_start_date date;
    v_end_date   date;
    v_year_int   int;
BEGIN
    IF p_year != 'All' THEN
        v_year_int := p_year::int;
        IF    p_period = 'Quý 1'            THEN v_start_date := make_date(v_year_int,1,1);  v_end_date := make_date(v_year_int,3,31);
        ELSIF p_period = 'Quý 2'            THEN v_start_date := make_date(v_year_int,4,1);  v_end_date := make_date(v_year_int,6,30);
        ELSIF p_period = 'Quý 3'            THEN v_start_date := make_date(v_year_int,7,1);  v_end_date := make_date(v_year_int,9,30);
        ELSIF p_period = 'Quý 4'            THEN v_start_date := make_date(v_year_int,10,1); v_end_date := make_date(v_year_int,12,31);
        ELSIF p_period = '6 tháng đầu năm'  THEN v_start_date := make_date(v_year_int,1,1);  v_end_date := make_date(v_year_int,6,30);
        ELSIF p_period = '6 tháng cuối năm' THEN v_start_date := make_date(v_year_int,7,1);  v_end_date := make_date(v_year_int,12,31);
        -- M1..M12
        ELSIF p_period ~ '^M[0-9]+$' THEN
            v_start_date := make_date(v_year_int, substring(p_period from 2)::int, 1);
            v_end_date   := (v_start_date + interval '1 month' - interval '1 day')::date;
        -- Q1..Q4
        ELSIF p_period ~ '^Q[1-4]$' THEN
            v_start_date := make_date(v_year_int, (substring(p_period from 2)::int - 1)*3 + 1, 1);
            v_end_date   := (v_start_date + interval '3 months' - interval '1 day')::date;
        ELSE  -- Cả năm / Toàn thời gian + năm cụ thể
            v_start_date := make_date(v_year_int,1,1);
            v_end_date   := make_date(v_year_int,12,31);
        END IF;
    END IF;

    RETURN QUERY
    WITH product_line_items AS (
        SELECT
            c.id AS contract_id,
            (item->>'productId') AS prod_id,
            c.value AS contract_value,
            COALESCE(NULLIF(item->>'outputPrice','')::numeric, 0)
                * COALESCE(NULLIF(item->>'quantity','')::numeric, 1) AS item_revenue
        FROM contracts c,
        jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(c.details->'lineItems') = 'array' THEN c.details->'lineItems'
                WHEN jsonb_typeof(c.line_items)           = 'array' THEN c.line_items
                ELSE '[]'::jsonb
            END
        ) AS item
        WHERE c.status IN ('Processing', 'Handover', 'Acceptance', 'Completed')
          AND item->>'productId' IS NOT NULL
          AND item->>'productId' != ''
          AND (array_length(p_product_ids, 1) IS NULL OR (item->>'productId') = ANY(p_product_ids))
          AND (p_unit_id = 'all' OR c.unit_id = p_unit_id)
          AND (v_start_date IS NULL OR c.signed_date >= v_start_date)
          AND (v_end_date   IS NULL OR c.signed_date <= v_end_date)
    )
    SELECT
        pc.prod_id            AS product_id,
        SUM(pc.contract_value) AS total_contract_value,
        SUM(pc.item_revenue)   AS total_revenue
    FROM product_line_items pc
    GROUP BY pc.prod_id;
END;
$$ LANGUAGE plpgsql;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FUNCTION: get_brands_with_stats  (filter theo unit / year / period)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_brands_with_stats(
    p_search  text    DEFAULT NULL,
    p_unit_id text    DEFAULT 'all',
    p_year    text    DEFAULT 'All',
    p_period  text    DEFAULT 'Toàn thời gian',
    p_limit   int     DEFAULT NULL,
    p_offset  int     DEFAULT NULL
)
RETURNS TABLE (
    id                   uuid,
    name                 text,
    code                 text,
    country              text,
    website              text,
    description          text,
    is_active            boolean,
    total_contract_value numeric,
    total_revenue        numeric,
    product_count        bigint
) AS $$
DECLARE
    v_start_date date;
    v_end_date   date;
    v_year_int   int;
BEGIN
    IF p_year IS NOT NULL AND p_year != 'All' THEN
        v_year_int := p_year::int;
        v_start_date := make_date(v_year_int, 1, 1);
        v_end_date   := make_date(v_year_int, 12, 31);

        IF p_period IS NOT NULL AND p_period != 'Toàn thời gian' THEN
            IF    p_period ~ '^M[0-9]+$' THEN
                v_start_date := make_date(v_year_int, substring(p_period from 2)::int, 1);
                v_end_date   := (v_start_date + interval '1 month' - interval '1 day')::date;
            ELSIF p_period ~ '^Q[1-4]$' THEN
                v_start_date := make_date(v_year_int, (substring(p_period from 2)::int - 1)*3 + 1, 1);
                v_end_date   := (v_start_date + interval '3 months' - interval '1 day')::date;
            ELSIF p_period = 'Quý 1'            THEN v_start_date := make_date(v_year_int,1,1);  v_end_date := make_date(v_year_int,3,31);
            ELSIF p_period = 'Quý 2'            THEN v_start_date := make_date(v_year_int,4,1);  v_end_date := make_date(v_year_int,6,30);
            ELSIF p_period = 'Quý 3'            THEN v_start_date := make_date(v_year_int,7,1);  v_end_date := make_date(v_year_int,9,30);
            ELSIF p_period = 'Quý 4'            THEN v_start_date := make_date(v_year_int,10,1); v_end_date := make_date(v_year_int,12,31);
            ELSIF p_period = '6 tháng đầu năm'  THEN v_start_date := make_date(v_year_int,1,1);  v_end_date := make_date(v_year_int,6,30);
            ELSIF p_period = '6 tháng cuối năm' THEN v_start_date := make_date(v_year_int,7,1);  v_end_date := make_date(v_year_int,12,31);
            END IF;
        END IF;
    END IF;

    RETURN QUERY
    WITH brand_line_items AS (
        SELECT
            p.brand_id,
            c.value AS contract_value,
            COALESCE(NULLIF(item->>'outputPrice','')::numeric, 0)
                * COALESCE(NULLIF(item->>'quantity','')::numeric, 1) AS item_revenue
        FROM contracts c,
        jsonb_array_elements(
            CASE
                WHEN jsonb_typeof(c.details->'lineItems') = 'array' THEN c.details->'lineItems'
                WHEN jsonb_typeof(c.line_items)           = 'array' THEN c.line_items
                ELSE '[]'::jsonb
            END
        ) AS item
        JOIN products p ON p.id::text = (item->>'productId')
        WHERE c.status IN ('Processing', 'Handover', 'Acceptance', 'Completed')
          AND item->>'productId' IS NOT NULL
          AND item->>'productId' != ''
          AND p.brand_id IS NOT NULL
          AND (p_unit_id = 'all' OR c.unit_id = p_unit_id)
          AND (v_start_date IS NULL OR c.signed_date >= v_start_date)
          AND (v_end_date   IS NULL OR c.signed_date <= v_end_date)
    ),
    brand_stats AS (
        SELECT
            brand_id,
            SUM(contract_value) AS total_contract_value,  -- tổng giá trị HĐ
            SUM(item_revenue)   AS total_revenue           -- doanh thu sản phẩm (outputPrice×qty)
        FROM brand_line_items
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
        COALESCE(bs.total_revenue,        0)::numeric,
        (SELECT count(*) FROM products p2 WHERE p2.brand_id = b.id)::bigint AS product_count
    FROM brands b
    LEFT JOIN brand_stats bs ON b.id = bs.brand_id
    WHERE (p_search IS NULL OR b.name ILIKE '%' || p_search || '%' OR b.code ILIKE '%' || p_search || '%')
      AND b.is_active = true
    ORDER BY COALESCE(bs.total_revenue, 0) DESC, b.name
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
