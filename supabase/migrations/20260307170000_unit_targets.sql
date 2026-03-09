-- Unit Targets: per-year KPI targets for each unit
-- Mirrors employee_targets pattern

CREATE TABLE IF NOT EXISTS public.unit_targets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    signing NUMERIC DEFAULT 0,
    revenue NUMERIC DEFAULT 0,
    admin_profit NUMERIC DEFAULT 0,
    rev_profit NUMERIC DEFAULT 0,
    cash NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(unit_id, year)
);

-- Enable RLS
ALTER TABLE public.unit_targets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view
CREATE POLICY "unit_targets_select" ON public.unit_targets
    FOR SELECT TO authenticated USING (true);

-- All authenticated users can insert/update/delete (app-layer permission check)
CREATE POLICY "unit_targets_insert" ON public.unit_targets
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "unit_targets_update" ON public.unit_targets
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "unit_targets_delete" ON public.unit_targets
    FOR DELETE TO authenticated USING (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_unit_targets_unit_year ON public.unit_targets(unit_id, year);

-- Migrate existing unit.target data to unit_targets for 2026
-- This will copy the current single target into a 2026 row for each unit
INSERT INTO public.unit_targets (unit_id, year, signing, revenue, admin_profit, rev_profit, cash)
SELECT
    id,
    2026,
    COALESCE((target->>'signing')::numeric, 0),
    COALESCE((target->>'revenue')::numeric, 0),
    COALESCE((target->>'adminProfit')::numeric, 0),
    COALESCE((target->>'revProfit')::numeric, 0),
    COALESCE((target->>'cash')::numeric, 0)
FROM public.units
WHERE target IS NOT NULL
  AND (target->>'signing')::numeric > 0
ON CONFLICT (unit_id, year) DO NOTHING;
