-- Mở rộng bảng customers cho CRM
-- industry đã là TEXT[], giữ nguyên
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS company_size TEXT,
  ADD COLUMN IF NOT EXISTS annual_revenue DECIMAL,
  ADD COLUMN IF NOT EXISTS crm_owner UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_company_size_check') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_company_size_check
      CHECK (company_size IS NULL OR company_size IN ('startup','sme','large','enterprise'));
  END IF;
END $$;
