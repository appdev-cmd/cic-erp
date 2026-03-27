-- Calculate administrative profit and revenue profit automatically on insert/update
CREATE OR REPLACE FUNCTION calculate_contract_profits()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. admin_profit = value - estimated_cost
    NEW.admin_profit := COALESCE(NEW.value, 0) - COALESCE(NEW.estimated_cost, 0);

    -- 2. rev_profit = (actual_revenue / value) * admin_profit (proportional to invoiced revenue)
    IF COALESCE(NEW.value, 0) > 0 THEN
        NEW.rev_profit := (COALESCE(NEW.actual_revenue, 0) / NEW.value) * NEW.admin_profit;
    ELSE
        NEW.rev_profit := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_contract_profits ON contracts;
CREATE TRIGGER trigger_calculate_contract_profits
BEFORE INSERT OR UPDATE OF value, estimated_cost, actual_revenue ON contracts
FOR EACH ROW
EXECUTE FUNCTION calculate_contract_profits();

-- Fix get_employees_with_stats to use admin_profit and rev_profit from the contracts table
DROP FUNCTION IF EXISTS get_employees_with_stats(TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION get_employees_with_stats(p_unit_id TEXT DEFAULT NULL, p_year INTEGER DEFAULT NULL, p_search TEXT DEFAULT NULL)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    employee_code TEXT,
    email TEXT,
    unit_id TEXT,
    role_code TEXT,
    "position" TEXT,
    avatar TEXT,
    target JSONB,
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
    WITH emp_stats AS (
        SELECT
            c.employee_id AS stat_employee_id,
            COUNT(DISTINCT c.id) as stat_contract_count,
            SUM(COALESCE(c.value, 0)) as stat_total_signing,
            SUM(COALESCE(c.actual_revenue, 0)) as stat_total_revenue,
            SUM(COALESCE(c.admin_profit, COALESCE(c.value, 0) - COALESCE(c.estimated_cost, 0))) as stat_total_admin_profit,
            SUM(COALESCE(c.rev_profit, 0)) as stat_total_rev_profit
        FROM
            contracts c
        WHERE
            c.employee_id IS NOT NULL
            AND EXTRACT(YEAR FROM c.signed_date) = v_year
        GROUP BY
            c.employee_id
    ),
    payment_stats AS (
        SELECT
            c.employee_id,
            SUM(p.paid_amount) as total_cash
        FROM
            payments p
        JOIN
            contracts c ON p.contract_id = c.id
        WHERE
            c.employee_id IS NOT NULL
            AND EXTRACT(YEAR FROM c.signed_date) = v_year
        GROUP BY
            c.employee_id
    )
    SELECT
        e.id,
        e.name,
        e.employee_code,
        e.email,
        e.unit_id,
        e.role_code,
        e."position",
        e.avatar,
        CASE 
            WHEN et.id IS NOT NULL THEN
                jsonb_build_object(
                    'signing', COALESCE(et.signing, 0),
                    'revenue', COALESCE(et.revenue, 0),
                    'adminProfit', COALESCE(et.admin_profit, 0),
                    'revProfit', COALESCE(et.rev_profit, 0),
                    'cash', COALESCE(et.cash, 0)
                )
            ELSE COALESCE(e.target, '{"signing":0,"revenue":0,"adminProfit":0,"revProfit":0,"cash":0}'::jsonb)
        END AS target,
        COALESCE(es.stat_total_signing, 0) as total_signing,
        COALESCE(es.stat_total_revenue, 0) as total_revenue,
        COALESCE(es.stat_total_admin_profit, 0) as total_profit,
        COALESCE(es.stat_total_rev_profit, 0) as total_revenue_profit,
        COALESCE(ps.total_cash, 0) as total_cash,
        COALESCE(es.stat_contract_count, 0)::INTEGER as contract_count
    FROM
        employees e
    LEFT JOIN
        emp_stats es ON e.id = es.stat_employee_id
    LEFT JOIN
        payment_stats ps ON e.id = ps.employee_id
    LEFT JOIN
        employee_targets et ON e.id = et.employee_id AND et.unit_id = e.unit_id AND et.year = v_year
    WHERE
        (p_unit_id IS NULL OR e.unit_id = p_unit_id)
        AND (p_search IS NULL OR e.name ILIKE '%' || p_search || '%')
    ORDER BY
        COALESCE(es.stat_total_signing, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION get_employees_with_stats(TEXT, INTEGER, TEXT) SET search_path = public;

-- Fix get_units_with_stats to include total_revenue_profit
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
            0::NUMERIC AS total_cash
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

-- Backfill data
UPDATE contracts 
SET 
    admin_profit = COALESCE(value, 0) - COALESCE(estimated_cost, 0),
    rev_profit = CASE 
        WHEN COALESCE(value, 0) > 0 THEN (COALESCE(actual_revenue, 0) / COALESCE(value, 1)) * (COALESCE(value, 0) - COALESCE(estimated_cost, 0)) 
        ELSE 0 
    END;
