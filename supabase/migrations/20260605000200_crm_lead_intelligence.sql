-- ════════════════════════════════════════════════════════════════
-- CRM Lead Intelligence — phân tích AI cho lead
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.crm_lead_intelligence (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,

  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','gathered','completed','failed','outdated')),
  error_message TEXT,

  gathered_sources JSONB DEFAULT '[]',

  company_summary TEXT,
  technology_level TEXT
    CHECK (technology_level IN ('none','basic','intermediate','advanced')),
  industry_sector TEXT,
  project_pipeline JSONB,
  recommended_products JSONB,
  sales_insights JSONB,

  ai_score_contribution INT DEFAULT 0 CHECK (ai_score_contribution BETWEEN 0 AND 30),
  ai_score_reasoning TEXT,

  analyzed_at TIMESTAMPTZ,
  model_used TEXT,
  triggered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_intelligence_lead_id ON crm_lead_intelligence(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_intelligence_status ON crm_lead_intelligence(status);

ALTER TABLE crm_lead_intelligence ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_lead_intelligence' AND policyname = 'intel_read') THEN
    CREATE POLICY "intel_read" ON crm_lead_intelligence FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_lead_intelligence' AND policyname = 'intel_write') THEN
    CREATE POLICY "intel_write" ON crm_lead_intelligence FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Cột tham chiếu trên crm_leads
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS intelligence_status TEXT DEFAULT 'none'
    CHECK (intelligence_status IN ('none','pending','processing','gathered','completed','failed')),
  ADD COLUMN IF NOT EXISTS ai_score_contribution INT DEFAULT 0;

COMMENT ON COLUMN crm_leads.ai_score_contribution IS 'Điểm AI đóng góp (0-30) vào lead score';
