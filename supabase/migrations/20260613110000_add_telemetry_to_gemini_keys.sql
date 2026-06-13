-- ============================================================================
-- Gemini API Keys Telemetry Expansion
-- Adds columns to track total tokens (context) and estimated cost for billing monitoring
-- ============================================================================

ALTER TABLE public.gemini_keys 
  ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(15, 6) DEFAULT 0;

-- RPC to atomically increment usage, tokens, and estimated cost for a key
CREATE OR REPLACE FUNCTION public.increment_key_telemetry(
  key_id UUID,
  p_tokens INTEGER,
  p_cost NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.gemini_keys
  SET 
    usage_count = usage_count + 1,
    total_tokens = total_tokens + COALESCE(p_tokens, 0),
    estimated_cost = estimated_cost + COALESCE(p_cost, 0),
    status = 'active',
    last_used_at = NOW(),
    updated_at = NOW()
  WHERE id = key_id;
END;
$$;

