-- Enable unaccent extension (idempotent)
CREATE EXTENSION IF NOT EXISTS unaccent SCHEMA public;

-- Create immutable wrapper for unaccent (needed for indexes)
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text AS $$
    SELECT public.unaccent('public.unaccent', $1)
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- ================================================================
-- RPC: search_payments_unaccent
-- Search payments + joined customers.name + contracts.contract_code
-- ================================================================
CREATE OR REPLACE FUNCTION public.search_payments_unaccent(search_term text)
RETURNS TABLE(id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.id
    FROM payments p
    LEFT JOIN customers c ON c.id = p.customer_id
    LEFT JOIN contracts ct ON ct.id = p.contract_id
    WHERE
        public.f_unaccent(lower(COALESCE(p.invoice_number, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(p.reference, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(p.expense_category, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(p.notes, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(c.name, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(ct.contract_code, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%';
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- RPC: search_employees_unaccent
-- Search employees by name, position, employee_code
-- ================================================================
CREATE OR REPLACE FUNCTION public.search_employees_unaccent(search_term text)
RETURNS TABLE(id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT e.id
    FROM employees e
    WHERE
        public.f_unaccent(lower(COALESCE(e.name, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(e.position, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(e.employee_code, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%';
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- RPC: search_customers_unaccent
-- Search customers by name, short_name, tax_code
-- ================================================================
CREATE OR REPLACE FUNCTION public.search_customers_unaccent(search_term text)
RETURNS TABLE(id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT c.id
    FROM customers c
    WHERE
        public.f_unaccent(lower(COALESCE(c.name, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(c.short_name, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR COALESCE(c.tax_code, '') ILIKE '%' || search_term || '%';
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- RPC: search_tasks_unaccent
-- Search tasks by title, description
-- ================================================================
CREATE OR REPLACE FUNCTION public.search_tasks_unaccent(search_term text)
RETURNS TABLE(id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT t.id
    FROM tasks t
    WHERE
        public.f_unaccent(lower(COALESCE(t.title, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%'
        OR public.f_unaccent(lower(COALESCE(t.description, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%';
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- RPC: search_mentions_unaccent
-- Search profiles full_name for mention suggestions
-- ================================================================
CREATE OR REPLACE FUNCTION public.search_mentions_unaccent(search_term text)
RETURNS TABLE(id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.id
    FROM profiles p
    WHERE
        public.f_unaccent(lower(COALESCE(p.full_name, ''))) ILIKE '%' || public.f_unaccent(lower(search_term)) || '%';
END;
$$ LANGUAGE plpgsql STABLE;
