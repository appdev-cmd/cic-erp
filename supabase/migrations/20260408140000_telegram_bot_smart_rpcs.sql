-- ─── Thống kê tổng quan (dashboard) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_dashboard(p_employee_id TEXT)
RETURNS TABLE (
    total_contracts BIGINT,
    active_contracts BIGINT,
    total_value NUMERIC,
    total_receivables NUMERIC,
    total_cash_received NUMERIC,
    overdue_payments BIGINT,
    pending_tasks BIGINT,
    my_tasks BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role user_role; v_unit TEXT;
BEGIN
    SELECT p.role, p.unit_id INTO v_role, v_unit
    FROM profiles p WHERE p.employee_id = p_employee_id LIMIT 1;

    RETURN QUERY
    SELECT
        (SELECT count(*) FROM contracts c
         WHERE CASE WHEN v_role IN ('Admin','Leadership') THEN true
               ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END),
        (SELECT count(*) FROM contracts c
         WHERE c.status IN ('active','Đang thực hiện','in_progress')
         AND CASE WHEN v_role IN ('Admin','Leadership') THEN true
             ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END),
        (SELECT coalesce(sum(c.value),0) FROM contracts c
         WHERE CASE WHEN v_role IN ('Admin','Leadership') THEN true
               ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END),
        (SELECT coalesce(sum(c.receivables),0) FROM contracts c
         WHERE CASE WHEN v_role IN ('Admin','Leadership') THEN true
               ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END),
        (SELECT coalesce(sum(c.cash_received),0) FROM contracts c
         WHERE CASE WHEN v_role IN ('Admin','Leadership') THEN true
               ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END),
        (SELECT count(*) FROM payments pm
         JOIN contracts c ON c.id = pm.contract_id
         WHERE pm.status NOT IN ('paid','Đã thanh toán') AND pm.due_date < current_date
         AND CASE WHEN v_role IN ('Admin','Leadership') THEN true
             ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END),
        (SELECT count(*) FROM tasks t
         JOIN task_statuses ts ON ts.id = t.status_id
         WHERE ts.name NOT IN ('done','completed','Hoàn thành')
         AND CASE WHEN v_role IN ('Admin','Leadership') THEN true
             ELSE t.unit_id = v_unit END),
        (SELECT count(*) FROM tasks t
         JOIN task_statuses ts ON ts.id = t.status_id
         WHERE ts.name NOT IN ('done','completed','Hoàn thành')
         AND p_employee_id = ANY(t.assignees));
END; $$;

REVOKE ALL ON FUNCTION public.telegram_bot_dashboard(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_dashboard(TEXT) TO service_role;

-- ─── Thanh toán quá hạn ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_overdue_payments(
    p_employee_id TEXT, p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    payment_id TEXT, contract_code TEXT, contract_title TEXT,
    customer_name TEXT, amount NUMERIC, due_date DATE, days_overdue INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role user_role; v_unit TEXT;
BEGIN
    SELECT p.role, p.unit_id INTO v_role, v_unit
    FROM profiles p WHERE p.employee_id = p_employee_id LIMIT 1;

    RETURN QUERY
    SELECT pm.id, c.contract_code, left(c.title,80),
           cu.name, pm.amount, pm.due_date,
           (current_date - pm.due_date)::integer
    FROM payments pm
    JOIN contracts c ON c.id = pm.contract_id
    LEFT JOIN customers cu ON cu.id = c.customer_id
    WHERE pm.status NOT IN ('paid','Đã thanh toán')
      AND pm.due_date < current_date
      AND CASE WHEN v_role IN ('Admin','Leadership') THEN true
          ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END
    ORDER BY pm.due_date ASC
    LIMIT least(p_limit, 50);
END; $$;

REVOKE ALL ON FUNCTION public.telegram_bot_overdue_payments(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_overdue_payments(TEXT, INTEGER) TO service_role;

-- ─── Hợp đồng sắp hết hạn (30 ngày tới) ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_expiring_contracts(
    p_employee_id TEXT, p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    contract_code TEXT, title TEXT, customer_name TEXT,
    end_date DATE, days_remaining INTEGER, value NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role user_role; v_unit TEXT;
BEGIN
    SELECT p.role, p.unit_id INTO v_role, v_unit
    FROM profiles p WHERE p.employee_id = p_employee_id LIMIT 1;

    RETURN QUERY
    SELECT c.contract_code, left(c.title,80), cu.name,
           c.end_date, (c.end_date - current_date)::integer,
           c.value
    FROM contracts c
    LEFT JOIN customers cu ON cu.id = c.customer_id
    WHERE c.end_date IS NOT NULL
      AND c.end_date BETWEEN current_date AND current_date + p_days
      AND c.status NOT IN ('closed','cancelled','Đã đóng','Đã hủy')
      AND CASE WHEN v_role IN ('Admin','Leadership') THEN true
          ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END
    ORDER BY c.end_date ASC
    LIMIT 30;
END; $$;

REVOKE ALL ON FUNCTION public.telegram_bot_expiring_contracts(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_expiring_contracts(TEXT, INTEGER) TO service_role;

-- ─── Tasks của tôi ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_my_tasks(
    p_employee_id TEXT, p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    task_id UUID, title TEXT, priority TEXT,
    status_name TEXT, due_date DATE, project_name TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, left(t.title,100), t.priority,
           ts.name, t.due_date,
           pr.name
    FROM tasks t
    JOIN task_statuses ts ON ts.id = t.status_id
    LEFT JOIN projects pr ON pr.id = t.project_id
    WHERE p_employee_id = ANY(t.assignees)
      AND ts.name NOT IN ('done','completed','Hoàn thành')
    ORDER BY
        CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.due_date ASC NULLS LAST
    LIMIT least(p_limit, 50);
END; $$;

REVOKE ALL ON FUNCTION public.telegram_bot_my_tasks(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_my_tasks(TEXT, INTEGER) TO service_role;

-- ─── Tìm hợp đồng theo từ khóa ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_search_contracts(
    p_employee_id TEXT, p_keyword TEXT, p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    contract_code TEXT, title TEXT, customer_name TEXT,
    status TEXT, value NUMERIC, signed_date DATE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role user_role; v_unit TEXT; v_kw TEXT;
BEGIN
    v_kw := '%' || lower(trim(p_keyword)) || '%';
    SELECT p.role, p.unit_id INTO v_role, v_unit
    FROM profiles p WHERE p.employee_id = p_employee_id LIMIT 1;

    RETURN QUERY
    SELECT c.contract_code, left(c.title,100), cu.name,
           c.status, c.value, c.signed_date
    FROM contracts c
    LEFT JOIN customers cu ON cu.id = c.customer_id
    WHERE (lower(c.title) LIKE v_kw OR lower(c.contract_code) LIKE v_kw
           OR lower(coalesce(cu.name,'')) LIKE v_kw)
      AND CASE WHEN v_role IN ('Admin','Leadership') THEN true
          ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END
    ORDER BY c.signed_date DESC NULLS LAST
    LIMIT least(p_limit, 30);
END; $$;

REVOKE ALL ON FUNCTION public.telegram_bot_search_contracts(TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_search_contracts(TEXT, TEXT, INTEGER) TO service_role;

-- ─── Doanh thu theo tháng ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.telegram_bot_revenue_by_month(
    p_employee_id TEXT, p_year INTEGER DEFAULT NULL
)
RETURNS TABLE (month_label TEXT, contract_count BIGINT, total_value NUMERIC, total_revenue NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role user_role; v_unit TEXT; v_year INTEGER;
BEGIN
    v_year := coalesce(p_year, extract(year from current_date)::integer);
    SELECT p.role, p.unit_id INTO v_role, v_unit
    FROM profiles p WHERE p.employee_id = p_employee_id LIMIT 1;

    RETURN QUERY
    SELECT to_char(c.signed_date, 'YYYY-MM'),
           count(*), coalesce(sum(c.value),0), coalesce(sum(c.actual_revenue),0)
    FROM contracts c
    WHERE extract(year from c.signed_date) = v_year
      AND CASE WHEN v_role IN ('Admin','Leadership') THEN true
          ELSE c.unit_id = v_unit OR c.employee_id = p_employee_id END
    GROUP BY to_char(c.signed_date, 'YYYY-MM')
    ORDER BY 1;
END; $$;

REVOKE ALL ON FUNCTION public.telegram_bot_revenue_by_month(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.telegram_bot_revenue_by_month(TEXT, INTEGER) TO service_role;
