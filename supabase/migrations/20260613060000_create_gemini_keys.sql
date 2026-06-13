-- ============================================================================
-- Gemini API Keys Management — Database Schema
-- Supports key rotation, status tracking, and telemetry for AI features
-- ============================================================================

-- Create gemini_keys table
CREATE TABLE IF NOT EXISTS public.gemini_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'rate_limited')),
  usage_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.gemini_keys ENABLE ROW LEVEL SECURITY;

-- Select policy: Only Admin and Leadership roles can read the keys
CREATE POLICY "gemini_keys_select" ON public.gemini_keys 
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'Leadership')
  ));

-- Write policy (Insert, Update, Delete): Only Admin and Leadership can modify keys
CREATE POLICY "gemini_keys_write" ON public.gemini_keys 
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'Leadership')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('Admin', 'Leadership')
  ));

-- Create index on is_active and status for fast lookups during proxy requests
CREATE INDEX IF NOT EXISTS idx_gemini_keys_lookup ON public.gemini_keys (is_active, status);

-- Trigger to automatically update updated_at field
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN 
  NEW.updated_at = NOW(); 
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_updated_at_gemini_keys 
  BEFORE UPDATE ON public.gemini_keys
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at();
