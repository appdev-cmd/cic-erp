-- Thêm source_detail cho lead
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS source_detail TEXT;
