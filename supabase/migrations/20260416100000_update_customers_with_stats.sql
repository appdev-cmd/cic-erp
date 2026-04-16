-- Lên lịch cập nhật hàm get_customers_with_stats để có thể áp dụng filters (Unit, Year, Period)
-- Drop hàm cũ để tránh overload (trùng tên khác tham số)
DROP FUNCTION IF EXISTS get_customers_with_stats(TEXT, TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_customers_with_stats(
    p_search TEXT DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_industry TEXT DEFAULT NULL,
    p_limit INT DEFAULT NULL,
    p_offset INT DEFAULT NULL,
    p_unit_id TEXT DEFAULT 'all',
    p_year TEXT DEFAULT 'All',
    p_period TEXT DEFAULT 'Toàn thời gian'
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    short_name TEXT,
    tax_code TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    type TEXT,
    industry TEXT,
    contact_person TEXT,
    bank_account TEXT,
    bank_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ,
    contract_count BIGINT,
    total_value NUMERIC,
    total_revenue NUMERIC,
    active_contracts_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_year INT;
    v_month INT;
    v_quarter INT;
BEGIN
    -- Parse Date Range based on Year and Period
    IF p_year IS NOT NULL AND p_year != 'All' THEN
        v_year := p_year::INTEGER;
        v_start_date := make_date(v_year, 1, 1);
        v_end_date := make_date(v_year, 12, 31);
        
        IF p_period IS NOT NULL AND p_period != 'Toàn thời gian' THEN
            IF substring(p_period from 1 for 1) = 'M' THEN
                v_month := substring(p_period from 2)::INTEGER;
                v_start_date := make_date(v_year, v_month, 1);
                v_end_date := (v_start_date + interval '1 month' - interval '1 day')::DATE;
            ELSIF substring(p_period from 1 for 1) = 'Q' THEN
                v_quarter := substring(p_period from 2)::INTEGER;
                v_month := (v_quarter - 1) * 3 + 1;
                v_start_date := make_date(v_year, v_month, 1);
                v_end_date := (v_start_date + interval '3 months' - interval '1 day')::DATE;
            END IF;
        END IF;
    END IF;

    RETURN QUERY
    WITH customer_stats AS (
        SELECT 
            c.customer_id,
            COUNT(c.id) as contract_count,
            COALESCE(SUM(c.value), 0) as total_value,
            COALESCE(SUM(c.actual_revenue), 0) as total_revenue,
            COUNT(CASE WHEN c.status = 'Active' THEN 1 END) as active_contracts_count
        FROM 
            contracts c
        WHERE 
            (p_unit_id IS NULL OR p_unit_id = 'all' OR c.unit_id = p_unit_id)
            AND 
            (p_year IS NULL OR p_year = 'All' OR (
                c.signed_date >= v_start_date AND c.signed_date <= v_end_date
            ))
        GROUP BY 
            c.customer_id
    )
    SELECT 
        c.id,
        c.name,
        c.short_name,
        c.tax_code,
        c.address,
        c.phone,
        c.email,
        c.website,
        c.type,
        c.industry,
        c.contact_person,
        c.bank_account,
        c.bank_name,
        c.notes,
        c.created_at,
        
        COALESCE(s.contract_count, 0) as contract_count,
        COALESCE(s.total_value, 0) as total_value,
        COALESCE(s.total_revenue, 0) as total_revenue,
        COALESCE(s.active_contracts_count, 0) as active_contracts_count
    FROM 
        customers c
    LEFT JOIN 
        customer_stats s ON c.id = s.customer_id
    WHERE 
        (p_search IS NULL OR p_search = '' OR 
         CASE WHEN current_setting('server_version_num')::int >= 130000 THEN 
                -- We assume ILIKE is sufficient here (unaccent optimization happens in frontend if implemented)
                c.name ILIKE '%' || p_search || '%' OR 
                c.short_name ILIKE '%' || p_search || '%' OR 
                c.contact_person ILIKE '%' || p_search || '%'
              ELSE 
                c.name ILIKE '%' || p_search || '%' OR 
                c.short_name ILIKE '%' || p_search || '%' OR 
                c.contact_person ILIKE '%' || p_search || '%'
         END
        )
        AND
        (p_type IS NULL OR 
         p_type = 'all' OR
         (p_type = 'Customer' AND c.type IN ('Customer', 'Both', 'Customer,Supplier')) OR
         (p_type = 'Supplier' AND c.type IN ('Supplier', 'Both', 'Customer,Supplier')) OR
         c.type = p_type)
        AND
        (p_industry IS NULL OR p_industry = 'all' OR c.industry = p_industry)
    ORDER BY 
        -- Optimization: Sort by stats primarily so top value customers are always first when filtering
        COALESCE(s.total_value, 0) DESC,
        c.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Protect the function
ALTER FUNCTION get_customers_with_stats(TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT) SET search_path = public;
