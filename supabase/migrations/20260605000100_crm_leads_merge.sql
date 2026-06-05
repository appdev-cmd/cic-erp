-- ════════════════════════════════════════════════════════════════
-- CRM Lead Merge — hỗ trợ gộp lead trùng lặp
-- ════════════════════════════════════════════════════════════════

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_merged   BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_crm_leads_merged
  ON crm_leads(is_merged) WHERE is_merged = true;

COMMENT ON COLUMN crm_leads.merged_into IS 'Lead đích đã gộp vào (lead này là bản trùng, bị ẩn khỏi danh sách)';
COMMENT ON COLUMN crm_leads.is_merged IS 'True khi lead này đã được gộp vào lead khác';
