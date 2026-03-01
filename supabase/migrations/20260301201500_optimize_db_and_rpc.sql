-- D2 & D3: Optimizing Database Indexes
-- Ensure pg_trgm extension is created BEFORE the indexes that use it
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fix the old issue where pg_trgm might have failed. Create index safely.
CREATE INDEX IF NOT EXISTS contracts_search_idx ON contracts USING GIN (
    title gin_trgm_ops,
    party_a gin_trgm_ops,
    id gin_trgm_ops
);

-- D2: Index for unit_allocations (JSONB) to improve getChartDataFallback aggregation filter
CREATE INDEX IF NOT EXISTS contracts_unit_allocations_idx ON contracts USING GIN (unit_allocations);


-- S7: Fixing avoid Race Condition for getNextContractNumber
-- Create a table to track sequences per unit and year
CREATE TABLE IF NOT EXISTS public.contract_sequences (
    unit_id text NOT NULL,
    year integer NOT NULL,
    last_value integer NOT NULL DEFAULT 0,
    PRIMARY KEY (unit_id, year)
);

-- Enable RLS
ALTER TABLE public.contract_sequences ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to bypass RLS for this table or just rely on SECURITY DEFINER in the RPC.
-- Since the RPC is SECURITY DEFINER, it does not need explicit RLS policies for the table itself to work, 
-- but it's good practice. We'll leave it restricted so direct client requests can't alter sequences.

-- Create the RPC function that handles the sequence generation with row-level locking
CREATE OR REPLACE FUNCTION public.get_next_contract_number(p_unit_id text, p_year integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER 
AS $$
DECLARE
    v_next_val integer;
BEGIN
    -- Insert a new record if it doesn't exist, otherwise update and increment the value.
    -- ON CONFLICT DO UPDATE handles row-level concurrency automatically.
    INSERT INTO public.contract_sequences (unit_id, year, last_value)
    VALUES (p_unit_id, p_year, 1)
    ON CONFLICT (unit_id, year) 
    DO UPDATE SET last_value = public.contract_sequences.last_value + 1
    RETURNING last_value INTO v_next_val;

    RETURN v_next_val;
END;
$$;
