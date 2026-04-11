-- Fix get_units_with_stats to properly aggregate cash_received
DROP FUNCTION IF EXISTS get_units_with_stats(INTEGER);

CREATE OR REPLACE FUNCTION get_units_with_stats(p_year INTEGER DEFAULT NULL)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    code TEXT,
    type TEXT,
    target JSONB,
    functions TEXT,
    total_signing NUMERIC,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    total_revenue_profit NUMERIC,
    total_cash NUMERIC,
    contract_count INTEGER
) AS $$
DECLARE
    v_year INTEGER;
BEGIN
    v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);

    RETURN QUERY
    WITH
    -- Source 1: Lead unit contracts (unit_id matches) with their allocation %
    lead_contributions AS (
        SELECT
            c.unit_id AS contrib_unit_id,
            c.value,
            c.actual_revenue,
            c.estimated_cost,
            c.admin_profit,
            c.rev_profit,
            c.actual_cost,
            c.cash_received,
            -- If allocations exist, find lead's declared %; otherwise 100%
            CASE
                WHEN c.unit_allocations IS NOT NULL
                     AND jsonb_array_length(COALESCE(c.unit_allocations->'allocations', '[]'::jsonb)) > 0
                THEN COALESCE(
                    (SELECT (alloc->>'percent')::NUMERIC
                     FROM jsonb_array_elements(c.unit_allocations->'allocations') AS alloc
                     WHERE alloc->>'unitId' = c.unit_id AND alloc->>'role' = 'lead'
                     LIMIT 1),
                    100
                )
                ELSE 100
            END AS share_pct
        FROM contracts c
        WHERE c.unit_id IS NOT NULL
          AND (v_year IS NULL OR EXTRACT(YEAR FROM c.signed_date) = v_year)
    ),
    -- Source 2: Support unit allocations parsed from JSONB
    support_contributions AS (
        SELECT
            alloc->>'unitId' AS contrib_unit_id,
            c.value,
            c.actual_revenue,
            c.estimated_cost,
            c.admin_profit,
            c.rev_profit,
            c.actual_cost,
            c.cash_received,
            (alloc->>'percent')::NUMERIC AS share_pct
        FROM contracts c,
        LATERAL jsonb_array_elements(
            COALESCE(c.unit_allocations->'allocations', '[]'::jsonb)
        ) AS alloc
        WHERE alloc->>'role' = 'support'
          AND (alloc->>'unitId') IS NOT NULL
          AND (v_year IS NULL OR EXTRACT(YEAR FROM c.signed_date) = v_year)
    ),
    -- Combine both sources
    all_contributions AS (
        SELECT * FROM lead_contributions
        UNION ALL
        SELECT * FROM support_contributions
    ),
    -- Aggregate per unit with % applied
    unit_stats AS (
        SELECT
            ac.contrib_unit_id,
            COUNT(*) AS contract_count,
            SUM(COALESCE(ac.value, 0) * ac.share_pct / 100) AS total_signing,
            SUM(COALESCE(ac.actual_revenue, 0) * ac.share_pct / 100) AS total_revenue,
            SUM(COALESCE(ac.admin_profit, COALESCE(ac.value,0) - COALESCE(ac.estimated_cost,0)) * ac.share_pct / 100) AS total_profit,
            SUM(COALESCE(ac.rev_profit, 0) * ac.share_pct / 100) AS total_revenue_profit,
            SUM(COALESCE(ac.cash_received, 0) * ac.share_pct / 100) AS total_cash
        FROM all_contributions ac
        GROUP BY ac.contrib_unit_id
    )
    SELECT
        u.id,
        u.name,
        u.code,
        u.type,
        COALESCE(u.target, '{"signing": 0, "revenue": 0, "adminProfit": 0, "revProfit": 0, "cash": 0}'::jsonb) AS target,
        u.functions,
        COALESCE(us.total_signing, 0) AS total_signing,
        COALESCE(us.total_revenue, 0) AS total_revenue,
        COALESCE(us.total_profit, 0) AS total_profit,
        COALESCE(us.total_revenue_profit, 0) AS total_revenue_profit,
        COALESCE(us.total_cash, 0) AS total_cash,
        COALESCE(us.contract_count, 0)::INTEGER AS contract_count
    FROM
        units u
    LEFT JOIN
        unit_stats us ON u.id = us.contrib_unit_id
    ORDER BY
        u.code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION get_units_with_stats(INTEGER) SET search_path = public;
