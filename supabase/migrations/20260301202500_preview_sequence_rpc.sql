-- S7: Fixing the issue where previews auto-increment the sequence
-- Create a preview RPC function that merely checks the current sequence without incrementing
CREATE OR REPLACE FUNCTION public.preview_next_contract_number(p_unit_id text, p_year integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    v_last_val integer;
BEGIN
    SELECT last_value INTO v_last_val 
    FROM public.contract_sequences 
    WHERE unit_id = p_unit_id AND year = p_year;

    IF v_last_val IS NULL THEN
        -- If no sequence exists, check exactly how many contracts exist
        SELECT COUNT(*) INTO v_last_val 
        FROM contracts 
        WHERE unit_id = p_unit_id 
          AND signed_date >= (p_year || '-01-01')::date 
          AND signed_date <= (p_year || '-12-31')::date;
          
        RETURN COALESCE(v_last_val, 0) + 1;
    END IF;

    RETURN v_last_val + 1;
END;
$$;
