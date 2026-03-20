-- ============================================================
-- RPC: check_customer_duplicate
-- Check 3 criteria: tax_code, name, short_name
-- Uses f_unaccent + case-insensitive for Vietnamese
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_customer_duplicate(
    p_tax_code text DEFAULT NULL,
    p_name text DEFAULT NULL,
    p_short_name text DEFAULT NULL,
    p_exclude_id text DEFAULT NULL
)
RETURNS TABLE(
    id text,
    name text,
    short_name text,
    tax_code text,
    type text,
    match_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        c.id,
        c.name,
        c.short_name,
        c.tax_code,
        c.type,
        CASE
            WHEN p_tax_code IS NOT NULL AND length(trim(p_tax_code)) >= 5
                 AND trim(lower(c.tax_code)) = trim(lower(p_tax_code))
                THEN 'tax_code'::text
            WHEN p_name IS NOT NULL AND length(trim(p_name)) >= 2
                 AND public.f_unaccent(lower(trim(c.name))) = public.f_unaccent(lower(trim(p_name)))
                THEN 'name'::text
            WHEN p_short_name IS NOT NULL AND length(trim(p_short_name)) >= 2
                 AND public.f_unaccent(lower(trim(c.short_name))) = public.f_unaccent(lower(trim(p_short_name)))
                THEN 'short_name'::text
        END AS match_reason
    FROM public.customers c
    WHERE (p_exclude_id IS NULL OR c.id != p_exclude_id)
      AND (
          (p_tax_code IS NOT NULL AND length(trim(p_tax_code)) >= 5
           AND trim(lower(c.tax_code)) = trim(lower(p_tax_code)))
          OR
          (p_name IS NOT NULL AND length(trim(p_name)) >= 2
           AND public.f_unaccent(lower(trim(c.name))) = public.f_unaccent(lower(trim(p_name))))
          OR
          (p_short_name IS NOT NULL AND length(trim(p_short_name)) >= 2
           AND public.f_unaccent(lower(trim(c.short_name))) = public.f_unaccent(lower(trim(p_short_name))))
      );
END;
$$;

-- Unique index on tax_code (prevents duplicates at DB level)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tax_code_unique
ON public.customers (lower(trim(tax_code)))
WHERE tax_code IS NOT NULL AND trim(tax_code) != '';
