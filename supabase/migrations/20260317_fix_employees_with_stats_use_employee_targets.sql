-- Fix get_employees_with_stats to use employee_targets table for year-specific targets
-- instead of the static employees.target JSONB column
-- Root cause: Unit heads assign targets via employee_targets table (year-specific),
-- but the old RPC read from employees.target (always zeros)

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
            SUM(c.value) as stat_total_signing,
            SUM(COALESCE(c.actual_revenue, 0)) as stat_total_revenue,
            SUM(c.value - COALESCE(c.estimated_cost, 0)) as stat_total_profit
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
        -- Use employee_targets for year-specific targets, fallback to employees.target
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
        COALESCE(es.stat_total_profit, 0) as total_profit,
        COALESCE(es.stat_total_profit, 0) as total_revenue_profit,
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
