-- Add payment_term_days to contracts
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS payment_term_days integer;