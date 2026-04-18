-- =============================================================================
-- Fix: Doanh thu sản phẩm tính theo line item (outputPrice × quantity)
-- Apply lúc: 2026-04-17
-- Trước: SUM(actual_revenue) — doanh thu toàn bộ HĐ → SAI (double-count)
-- Sau:   SUM(outputPrice × quantity) — doanh thu riêng từng SP → ĐÚNG
-- =============================================================================

-- 1. FIX vw_products_with_stats
DROP VIEW IF EXISTS vw_products_with_stats CASCADE;

CREATE VIEW vw_products_with_stats AS
WITH product_line_items AS (
    SELECT
        c.id                                                          AS contract_id,
        (item->>'productId')                                          AS product_id,
        COALESCE((item->>'outputPrice')::numeric, 0)
            * COALESCE((item->>'quantity')::numeric, 1)               AS line_value
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
        SUM(pli.line_value)  AS total_contract_value,
        SUM(pli.line_value)  AS total_revenue
    FROM product_line_items pli
    GROUP BY pli.product_id
)
SELECT
    p.*,
    b.name                                    AS brand_name,
    s.short_name                              AS supplier_name,
    COALESCE(ps.total_contract_value, 0)      AS total_contract_value,
    COALESCE(ps.total_revenue, 0)             AS total_revenue
FROM products p
LEFT JOIN brands    b  ON p.brand_id    = b.id
LEFT JOIN customers s  ON p.supplier_id = s.id
LEFT JOIN product_stats ps ON p.id::text = ps.product_id;


-- =============================================================================
-- 2. FIX get_dynamic_product_stats
-- =============================================================================
DROP FUNCTION IF EXISTS get_dynamic_product_stats(text, text, text, text[]);

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
    v_month      int;
    v_quarter    int;
BEGIN
    IF p_year IS NOT NULL AND p_year != 'All' THEN
        v_year_int   := p_year::int;
        v_start_date := make_date(v_year_int, 1,  1);
        v_end_date   := make_date(v_year_int, 12, 31);

        IF p_period IS NOT NULL AND p_period != 'Toàn thời gian' THEN
            IF substring(p_period FROM 1 FOR 1) = 'M' THEN
                v_month      := substring(p_period FROM 2)::int;
                v_start_date := make_date(v_year_int, v_month, 1);
                v_end_date   := (v_start_date + interval '1 month' - interval '1 day')::date;
            ELSIF substring(p_period FROM 1 FOR 1) = 'Q'
              AND substring(p_period FROM 2) ~ '^[0-9]+$' THEN
                v_quarter    := substring(p_period FROM 2)::int;
                v_month      := (v_quarter - 1) * 3 + 1;
                v_start_date := make_date(v_year_int, v_month, 1);
                v_end_date   := (v_start_date + interval '3 months' - interval '1 day')::date;
            ELSIF p_period = 'Quý 1' THEN v_start_date := make_date(v_year_int,  1, 1); v_end_date := make_date(v_year_int,  3, 31);
            ELSIF p_period = 'Quý 2' THEN v_start_date := make_date(v_year_int,  4, 1); v_end_date := make_date(v_year_int,  6, 30);
            ELSIF p_period = 'Quý 3' THEN v_start_date := make_date(v_year_int,  7, 1); v_end_date := make_date(v_year_int,  9, 30);
            ELSIF p_period = 'Quý 4' THEN v_start_date := make_date(v_year_int, 10, 1); v_end_date := make_date(v_year_int, 12, 31);
            ELSIF p_period = '6 tháng đầu năm' THEN v_start_date := make_date(v_year_int, 1, 1); v_end_date := make_date(v_year_int, 6, 30);
            ELSIF p_period = '6 tháng cuối năm' THEN v_start_date := make_date(v_year_int, 7, 1); v_end_date := make_date(v_year_int, 12, 31);
            END IF;
        END IF;
    END IF;

    RETURN QUERY
    WITH product_line_items AS (
        SELECT
            c.id                                                      AS contract_id,
            (item->>'productId')                                      AS prod_id,
            COALESCE((item->>'outputPrice')::numeric, 0)
                * COALESCE((item->>'quantity')::numeric, 1)           AS line_value
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
        pli.prod_id                 AS product_id,
        SUM(pli.line_value)         AS total_contract_value,
        SUM(pli.line_value)         AS total_revenue
    FROM product_line_items pli
    GROUP BY pli.prod_id;
END;
$$ LANGUAGE plpgsql;
