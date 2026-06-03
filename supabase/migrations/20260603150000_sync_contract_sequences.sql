-- Migration: Sync contract sequences automatically
-- Created at: 2026-06-03
-- Purpose: Maintain sequence integrity by automatically updating contract_sequences on insert/update of contracts

-- 1. Create or replace the sequence sync trigger function
CREATE OR REPLACE FUNCTION public.sync_contract_sequence()
RETURNS TRIGGER AS $$
DECLARE
    v_stt_text text;
    v_stt integer;
    v_year integer;
BEGIN
    -- Only proceed if contract_code is not null and unit_id is not null
    IF NEW.contract_code IS NOT NULL AND NEW.unit_id IS NOT NULL THEN
        -- Extract the numeric part (STT) from contract_code (e.g., VV_066/... or HĐ_078/... -> 066 or 078)
        -- Uses pattern matching up to the first underscore, followed by digits, then a slash
        v_stt_text := substring(NEW.contract_code from '^[^_]+_(\d+)/');
        
        IF v_stt_text IS NOT NULL THEN
            v_stt := v_stt_text::integer;
            v_year := coalesce(extract(year from NEW.signed_date)::integer, extract(year from now())::integer);
            
            -- Insert or update the sequence to the greatest value to keep it in sync
            INSERT INTO public.contract_sequences (unit_id, year, last_value)
            VALUES (NEW.unit_id, v_year, v_stt)
            ON CONFLICT (unit_id, year)
            DO UPDATE SET last_value = GREATEST(public.contract_sequences.last_value, v_stt);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to contracts table
DROP TRIGGER IF EXISTS trigger_sync_contract_sequence ON public.contracts;

CREATE TRIGGER trigger_sync_contract_sequence
AFTER INSERT OR UPDATE OF contract_code, unit_id, signed_date ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.sync_contract_sequence();

-- 3. One-time synchronization of all existing contract numbers into contract_sequences
INSERT INTO public.contract_sequences (unit_id, year, last_value)
SELECT 
    unit_id,
    coalesce(extract(year from signed_date)::integer, 2026) as year,
    max((substring(contract_code from '^[^_]+_(\d+)/'))::integer) as last_value
FROM public.contracts
WHERE contract_code IS NOT NULL 
  AND unit_id IS NOT NULL
  AND substring(contract_code from '^[^_]+_(\d+)/') IS NOT NULL
GROUP BY unit_id, year
ON CONFLICT (unit_id, year)
DO UPDATE SET last_value = GREATEST(public.contract_sequences.last_value, EXCLUDED.last_value);
