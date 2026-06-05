-- Mở rộng bảng customer_contacts cho CRM
ALTER TABLE customer_contacts
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS zalo TEXT,
  ADD COLUMN IF NOT EXISTS birthday DATE,
  ADD COLUMN IF NOT EXISTS decision_role TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_contacts_decision_role_check') THEN
    ALTER TABLE customer_contacts ADD CONSTRAINT customer_contacts_decision_role_check
      CHECK (decision_role IN ('decision_maker','influencer','user','champion','blocker','unknown'));
  END IF;
END $$;
