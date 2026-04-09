-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.application_evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  evaluator_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  rating INTEGER,
  notes TEXT,
  criteria_scores JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(application_id, evaluator_id)
);

-- Enable RLS
ALTER TABLE public.application_evaluations ENABLE ROW LEVEL SECURITY;

-- Read policy (authenticated users)
CREATE POLICY "application_evaluations_select" ON public.application_evaluations
  FOR SELECT TO authenticated USING (true);

-- Insert policy
CREATE POLICY "application_evaluations_insert" ON public.application_evaluations
  FOR INSERT TO authenticated WITH CHECK (true);

-- Update policy
CREATE POLICY "application_evaluations_update" ON public.application_evaluations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Delete policy
CREATE POLICY "application_evaluations_delete" ON public.application_evaluations
  FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_application_evaluations_application_id ON public.application_evaluations(application_id);
CREATE INDEX IF NOT EXISTS idx_application_evaluations_evaluator_id ON public.application_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_application_evaluations_created_at ON public.application_evaluations(created_at);

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.application_evaluations;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.application_evaluations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
