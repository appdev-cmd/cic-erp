-- Fix get_kpi_stats to handle p_year=NULL correctly for all years
CREATE OR REPLACE FUNCTION get_kpi_stats(
  p_entity_id TEXT,
  p_type TEXT, 
  p_year INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_result JSONB;
BEGIN
  IF p_year IS NOT NULL THEN
    v_start_date := make_date(p_year, 1, 1);
    v_end_date := make_date(p_year, 12, 31);
  END IF;

  IF p_type = 'employee' THEN
    SELECT jsonb_build_object(
      'contractCount', COUNT(*),
      'totalSigning', COALESCE(SUM(value), 0),
      'totalRevenue', COALESCE(SUM(actual_revenue), 0),
      'totalProfit', COALESCE(SUM(value - COALESCE(estimated_cost, 0)), 0)
    ) INTO v_result
    FROM contracts
    WHERE employee_id = p_entity_id 
      AND (p_year IS NULL OR signed_date BETWEEN v_start_date AND v_end_date);

  ELSIF p_type = 'unit' THEN
    SELECT jsonb_build_object(
      'contractCount', COUNT(*),
      'totalSigning', COALESCE(SUM(value), 0),
      'totalRevenue', COALESCE(SUM(actual_revenue), 0),
      'totalProfit', COALESCE(SUM(value - COALESCE(estimated_cost, 0)), 0)
    ) INTO v_result
    FROM contracts
    WHERE unit_id = p_entity_id 
      AND (p_year IS NULL OR signed_date BETWEEN v_start_date AND v_end_date);
  
  ELSE
    RAISE EXCEPTION 'Invalid type. Must be employee or unit';
  END IF;

  RETURN v_result;
END;
$$;

-- Fix get_units_with_stats
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
    total_cash NUMERIC,
    contract_count INTEGER
) AS $$
DECLARE
    v_year INTEGER;
BEGIN
    v_year := p_year;

    RETURN QUERY
    WITH
    lead_contributions AS (
        SELECT
            c.unit_id AS contrib_unit_id,
            c.value,
            c.actual_revenue,
            c.estimated_cost,
            c.actual_cost,
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
    support_contributions AS (
        SELECT
            alloc->>'unitId' AS contrib_unit_id,
            c.value,
            c.actual_revenue,
            c.estimated_cost,
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
    all_contributions AS (
        SELECT * FROM lead_contributions
        UNION ALL
        SELECT * FROM support_contributions
    ),
    unit_stats AS (
        SELECT
            ac.contrib_unit_id,
            COUNT(*) AS contract_count,
            SUM(ac.value * ac.share_pct / 100) AS total_signing,
            SUM(ac.actual_revenue * ac.share_pct / 100) AS total_revenue,
            SUM((ac.value - COALESCE(ac.estimated_cost, 0)) * ac.share_pct / 100) AS total_profit,
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

-- Fix get_employees_with_stats
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
    total_cash NUMERIC,
    contract_count INTEGER
) AS $$
DECLARE
    v_year INTEGER;
BEGIN
    v_year := p_year;

    RETURN QUERY
    WITH emp_stats AS (
        SELECT
            c.employee_id,
            COUNT(DISTINCT c.id) as stat_contract_count,
            SUM(c.value) as stat_total_signing,
            SUM(c.actual_revenue) as stat_total_revenue,
            SUM(c.value - COALESCE(c.estimated_cost, 0)) as stat_total_profit
        FROM
            contracts c
        WHERE
            c.employee_id IS NOT NULL
            AND (v_year IS NULL OR EXTRACT(YEAR FROM c.signed_date) = v_year)
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
            AND (v_year IS NULL OR EXTRACT(YEAR FROM c.signed_date) = v_year)
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
        e.target,
        COALESCE(es.stat_total_signing, 0) as total_signing,
        COALESCE(es.stat_total_revenue, 0) as total_revenue,
        COALESCE(es.stat_total_profit, 0) as total_profit,
        COALESCE(ps.total_cash, 0) as total_cash,
        COALESCE(es.stat_contract_count, 0)::INTEGER as contract_count
    FROM
        employees e
    LEFT JOIN
        emp_stats es ON e.id = es.employee_id
    LEFT JOIN
        payment_stats ps ON e.id = ps.employee_id
    WHERE
        (p_unit_id IS NULL OR e.unit_id = p_unit_id)
        AND (p_search IS NULL OR e.name ILIKE '%' || p_search || '%')
    ORDER BY
        COALESCE(es.stat_total_signing, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
