-- Thêm cột region cho lead (vùng miền)
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'unknown';

-- Thêm check constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_leads_region_check') THEN
    ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_region_check
      CHECK (region IN ('north','central','south','unknown'));
  END IF;
END $$;
