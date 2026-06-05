-- Mở rộng bảng products cho CRM
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ai_description TEXT,
  ADD COLUMN IF NOT EXISTS target_customers TEXT,
  ADD COLUMN IF NOT EXISTS crm_visible BOOLEAN DEFAULT true;
