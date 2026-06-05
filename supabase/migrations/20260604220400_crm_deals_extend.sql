-- Mở rộng bảng crm_deals: liên kết lead, tags, lost_reason, contract_id, source_detail
ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_detail TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_deals_lead_id ON crm_deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contract_id ON crm_deals(contract_id);
