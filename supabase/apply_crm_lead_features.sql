-- ════════════════════════════════════════════════════════════════════════════
-- CRM LEAD — Script hợp nhất, idempotent (an toàn chạy lại nhiều lần)
-- Dán toàn bộ file này vào Supabase Dashboard → SQL Editor → Run.
-- Bao gồm: stage pipeline mới, source_detail/region, completion, merge,
--          auto-assignment, AI intelligence, + extends deals/customers/contacts/products.
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CỘT BỔ SUNG TRÊN crm_leads
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS source_detail TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS completion_result TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completion_note   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_opportunity    BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at      TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS merged_into       UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_merged         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS intelligence_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ai_score_contribution INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS potential_level  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS address          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_position TEXT DEFAULT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_leads_region_check') THEN
    ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_region_check
      CHECK (region IN ('north','central','south','unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_leads_intelligence_status_check') THEN
    ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_intelligence_status_check
      CHECK (intelligence_status IN ('none','pending','processing','gathered','completed','failed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_leads_potential_level_check') THEN
    ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_potential_level_check
      CHECK (potential_level IS NULL OR potential_level IN ('very_low','low','medium','high','none'));
  END IF;
END $$;

-- is_claimed: generated column (chỉ thêm nếu chưa có)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='crm_leads' AND column_name='is_claimed') THEN
    ALTER TABLE crm_leads
      ADD COLUMN is_claimed BOOLEAN GENERATED ALWAYS AS (assigned_to IS NOT NULL) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_leads_is_opportunity ON crm_leads(is_opportunity) WHERE is_opportunity IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_merged ON crm_leads(is_merged) WHERE is_merged = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PIPELINE STAGE — 4 trạng thái (idempotent — không tạo bản trùng)
--    Mới → Đang xử lý → Tiềm năng cao (win) → Không tiềm năng (lose)
-- ─────────────────────────────────────────────────────────────────────────────
-- 2a. Đổi tên các stage cũ → tên mới (no-op nếu đã đổi)
UPDATE crm_stage_templates SET name='Mới'        WHERE entity_type='lead' AND name='Đầu mối mới khởi tạo';
UPDATE crm_stage_templates SET name='Đang xử lý'  WHERE entity_type='lead' AND name='Phân loại tiềm năng thấp';
UPDATE crm_stage_templates SET name='Tiềm năng cao' WHERE entity_type='lead' AND name IN ('Chuyển đổi','Hoàn thành');
UPDATE crm_stage_templates SET name='Không tiềm năng' WHERE entity_type='lead' AND name='Không đủ ĐK';

-- 2b. Remap leads ra khỏi các stage sẽ bị gộp, trước khi xoá (FK luôn hợp lệ)
UPDATE crm_leads SET stage_id = (
  SELECT id FROM crm_stage_templates WHERE entity_type='lead' AND name='Đang xử lý' LIMIT 1)
WHERE stage_id IN (
  SELECT id FROM crm_stage_templates
  WHERE entity_type='lead' AND name IN ('Đã liên hệ','Phân loại tiềm năng cao','Đủ điều kiện'));
UPDATE crm_leads SET stage_id = (
  SELECT id FROM crm_stage_templates WHERE entity_type='lead' AND name='Không tiềm năng' LIMIT 1)
WHERE stage_id IN (
  SELECT id FROM crm_stage_templates
  WHERE entity_type='lead' AND name IN ('Mất','Thất bại'));

-- 2c. Xoá các stage thừa
DELETE FROM crm_stage_templates
WHERE entity_type='lead' AND name IN ('Đã liên hệ','Phân loại tiềm năng cao','Đủ điều kiện','Mất','Thất bại');

-- 2d. Thêm các stage còn thiếu (chỉ insert nếu chưa tồn tại)
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
SELECT 'lead','Mới','#93C5FD',1,false,false
WHERE NOT EXISTS (SELECT 1 FROM crm_stage_templates WHERE entity_type='lead' AND name='Mới');
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
SELECT 'lead','Đang xử lý','#60A5FA',2,false,false
WHERE NOT EXISTS (SELECT 1 FROM crm_stage_templates WHERE entity_type='lead' AND name='Đang xử lý');
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
SELECT 'lead','Tiềm năng cao','#22C55E',3,false,false
WHERE NOT EXISTS (SELECT 1 FROM crm_stage_templates WHERE entity_type='lead' AND name='Tiềm năng cao');
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
SELECT 'lead','Không tiềm năng','#6B7280',4,false,true
WHERE NOT EXISTS (SELECT 1 FROM crm_stage_templates WHERE entity_type='lead' AND name='Không tiềm năng');

-- 2e. Chuẩn hoá color / sort_order / win-lose về trạng thái cuối
UPDATE crm_stage_templates SET color='#93C5FD', sort_order=1, is_win=false, is_lose=false WHERE entity_type='lead' AND name='Mới';
UPDATE crm_stage_templates SET color='#60A5FA', sort_order=2, is_win=false, is_lose=false WHERE entity_type='lead' AND name='Đang xử lý';
UPDATE crm_stage_templates SET color='#22C55E', sort_order=3, is_win=false, is_lose=false WHERE entity_type='lead' AND name='Tiềm năng cao';
UPDATE crm_stage_templates SET color='#6B7280', sort_order=4, is_win=false, is_lose=true  WHERE entity_type='lead' AND name='Không tiềm năng';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. MIGRATE DỮ LIỆU SOURCE CŨ → ENUM MỚI
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE crm_leads SET source = 'social'   WHERE source IN ('Zalo','zalo','Telegram','telegram');
UPDATE crm_leads SET source = 'email'    WHERE source IN ('Email');
UPDATE crm_leads SET source = 'phone'    WHERE source IN ('Điện thoại','Call','call');
UPDATE crm_leads SET source = 'website'  WHERE source IN ('Website','website');
UPDATE crm_leads SET source = 'referral' WHERE source IN ('Giới thiệu','referral');
UPDATE crm_leads SET source = 'event'    WHERE source IN ('Sự kiện','event');
UPDATE crm_leads SET source = 'other'
  WHERE source IS NOT NULL
    AND source NOT IN ('website','email','phone','referral','social','event','import','api','other');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. EXTENDS: deals / customers / customer_contacts / products
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE crm_deals
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_detail TEXT;
CREATE INDEX IF NOT EXISTS idx_crm_deals_lead_id ON crm_deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_contract_id ON crm_deals(contract_id);

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

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ai_description TEXT,
  ADD COLUMN IF NOT EXISTS target_customers TEXT,
  ADD COLUMN IF NOT EXISTS crm_visible BOOLEAN DEFAULT true;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. AUTO-ASSIGNMENT: bảng config + log + hàm + trigger + view
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_unit_assignment_config (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  unit_id     TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  product_ids TEXT[] DEFAULT '{}',
  regions     TEXT[] DEFAULT '{north,central,south}',
  priority    INT DEFAULT 0,
  is_default  BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_unit_assignment_active ON crm_unit_assignment_config(is_active, priority DESC);
ALTER TABLE crm_unit_assignment_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_unit_assignment_config' AND policyname='uac_read') THEN
    CREATE POLICY "uac_read" ON crm_unit_assignment_config FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_unit_assignment_config' AND policyname='uac_write') THEN
    CREATE POLICY "uac_write" ON crm_unit_assignment_config FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.crm_assignment_log (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id           UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
  assigned_unit_id  TEXT REFERENCES units(id),
  candidate_units   TEXT[],
  balance_triggered BOOLEAN DEFAULT false,
  assigned_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignment_log_lead ON crm_assignment_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_assignment_log_unit ON crm_assignment_log(assigned_unit_id, assigned_at);
ALTER TABLE crm_assignment_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_assignment_log' AND policyname='log_read') THEN
    CREATE POLICY "log_read" ON crm_assignment_log FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_assignment_log' AND policyname='log_write') THEN
    CREATE POLICY "log_write" ON crm_assignment_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION assign_lead_to_unit(p_lead_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_lead          crm_leads%ROWTYPE;
  v_unit_id       TEXT := NULL;
  v_customer_id   TEXT;
  v_lead_products TEXT[];
  v_region        TEXT;
  v_balance_threshold INT := 5;
  v_balance_window INTERVAL := '7 days';
  v_candidates    TEXT[] := '{}';
  v_candidate_count INT := 0;
  v_min_count     INT;
  v_max_count     INT;
  v_balanced      BOOLEAN := false;
BEGIN
  SELECT * INTO v_lead FROM crm_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_region := COALESCE(v_lead.region, 'unknown');

  BEGIN
    v_lead_products := COALESCE(ARRAY(
      SELECT COALESCE(elem->>'productId', elem->>'product_id', trim(both '"' from elem::text))
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_lead.products) = 'array' THEN v_lead.products ELSE '[]'::jsonb END
      ) elem
    ), '{}'::TEXT[]);
  EXCEPTION WHEN others THEN v_lead_products := '{}'::TEXT[];
  END;

  v_customer_id := v_lead.customer_id;
  IF v_customer_id IS NULL AND v_lead.company_name IS NOT NULL THEN
    SELECT id INTO v_customer_id FROM customers
    WHERE lower(trim(name)) = lower(trim(v_lead.company_name)) LIMIT 1;
  END IF;
  IF v_customer_id IS NOT NULL THEN
    SELECT unit_id INTO v_unit_id FROM crm_deals
    WHERE customer_id = v_customer_id AND unit_id IS NOT NULL
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_unit_id IS NULL THEN
    SELECT COALESCE(ARRAY_AGG(uac.unit_id), '{}') INTO v_candidates
    FROM crm_unit_assignment_config uac
    WHERE uac.is_active
      AND (cardinality(uac.product_ids) = 0 OR cardinality(v_lead_products) = 0 OR uac.product_ids && v_lead_products)
      AND ('national' = ANY(uac.regions) OR cardinality(uac.regions) = 0 OR v_region = ANY(uac.regions) OR v_region = 'unknown');
    v_candidate_count := cardinality(v_candidates);

    IF v_candidate_count = 1 THEN
      v_unit_id := v_candidates[1];
    ELSIF v_candidate_count > 1 THEN
      WITH cand AS (
        SELECT uac.unit_id, uac.priority,
          (SELECT COUNT(*) FROM crm_leads l WHERE l.unit_id = uac.unit_id AND l.created_at >= NOW() - v_balance_window) AS load
        FROM crm_unit_assignment_config uac
        WHERE uac.is_active
          AND (cardinality(uac.product_ids) = 0 OR cardinality(v_lead_products) = 0 OR uac.product_ids && v_lead_products)
          AND ('national' = ANY(uac.regions) OR cardinality(uac.regions) = 0 OR v_region = ANY(uac.regions) OR v_region = 'unknown')
      )
      SELECT MIN(load), MAX(load) INTO v_min_count, v_max_count FROM cand;

      IF (v_max_count - v_min_count) > v_balance_threshold THEN
        v_balanced := true;
        WITH cand AS (
          SELECT uac.unit_id, uac.priority,
            (SELECT COUNT(*) FROM crm_leads l WHERE l.unit_id = uac.unit_id AND l.created_at >= NOW() - v_balance_window) AS load
          FROM crm_unit_assignment_config uac
          WHERE uac.is_active
            AND (cardinality(uac.product_ids) = 0 OR cardinality(v_lead_products) = 0 OR uac.product_ids && v_lead_products)
            AND ('national' = ANY(uac.regions) OR cardinality(uac.regions) = 0 OR v_region = ANY(uac.regions) OR v_region = 'unknown')
        )
        SELECT unit_id INTO v_unit_id FROM cand WHERE load = (SELECT MIN(load) FROM cand) ORDER BY priority DESC LIMIT 1;
      ELSE
        SELECT uac.unit_id INTO v_unit_id
        FROM crm_unit_assignment_config uac
        WHERE uac.is_active
          AND (cardinality(uac.product_ids) = 0 OR cardinality(v_lead_products) = 0 OR uac.product_ids && v_lead_products)
          AND ('national' = ANY(uac.regions) OR cardinality(uac.regions) = 0 OR v_region = ANY(uac.regions) OR v_region = 'unknown')
        ORDER BY uac.priority DESC LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF v_unit_id IS NULL THEN
    SELECT unit_id INTO v_unit_id FROM crm_unit_assignment_config WHERE is_default AND is_active LIMIT 1;
  END IF;

  IF v_unit_id IS NOT NULL THEN
    UPDATE crm_leads SET unit_id = v_unit_id, updated_at = NOW() WHERE id = p_lead_id;
    INSERT INTO crm_assignment_log (lead_id, assigned_unit_id, candidate_units, balance_triggered)
    VALUES (p_lead_id, v_unit_id, v_candidates, v_balanced);
  END IF;
  RETURN v_unit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trigger_auto_assign_lead()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unit_id IS NULL THEN PERFORM assign_lead_to_unit(NEW.id); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_lead ON crm_leads;
CREATE TRIGGER trg_auto_assign_lead AFTER INSERT ON crm_leads
FOR EACH ROW EXECUTE FUNCTION trigger_auto_assign_lead();

CREATE OR REPLACE VIEW crm_assignment_balance_stats AS
SELECT u.id AS unit_id, u.name AS unit_name, u.code AS unit_code,
  COUNT(l.id) FILTER (WHERE l.created_at >= NOW() - INTERVAL '7 days')  AS leads_7d,
  COUNT(l.id) FILTER (WHERE l.created_at >= NOW() - INTERVAL '30 days') AS leads_30d,
  (SELECT COUNT(*) FROM crm_assignment_log al
     WHERE al.assigned_unit_id = u.id AND al.balance_triggered = true
       AND al.assigned_at >= NOW() - INTERVAL '7 days') AS balance_redirects_7d
FROM units u
LEFT JOIN crm_leads l ON l.unit_id = u.id
GROUP BY u.id, u.name, u.code
ORDER BY leads_7d DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. AI LEAD INTELLIGENCE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_lead_intelligence (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','gathered','completed','failed','outdated')),
  error_message TEXT,
  gathered_sources JSONB DEFAULT '[]',
  company_summary TEXT,
  technology_level TEXT CHECK (technology_level IN ('none','basic','intermediate','advanced')),
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_lead_intelligence' AND policyname='intel_read') THEN
    CREATE POLICY "intel_read" ON crm_lead_intelligence FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='crm_lead_intelligence' AND policyname='intel_write') THEN
    CREATE POLICY "intel_write" ON crm_lead_intelligence FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- N. AO "KHÔNG TIỀM NĂNG" — tự xoá sau 30 ngày (pg_cron)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crm_purge_stale_no_potential_leads()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH del AS (
    DELETE FROM crm_leads l
    USING crm_stage_templates s
    WHERE l.stage_id = s.id
      AND s.entity_type = 'lead'
      AND s.is_lose = true
      AND l.completed_at IS NOT NULL
      AND l.completed_at < (now() - interval '30 days')
    RETURNING l.id
  )
  SELECT count(*) INTO v_deleted FROM del;
  RETURN v_deleted;
END;
$$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-purge-no-potential') THEN
    PERFORM cron.unschedule('crm-purge-no-potential');
  END IF;
  PERFORM cron.schedule('crm-purge-no-potential', '0 3 * * *',
    $cron$ SELECT crm_purge_stale_no_potential_leads(); $cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron chưa sẵn sàng (%) — bật pg_cron ở Dashboard rồi lên lịch thủ công.', SQLERRM;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- HOÀN TẤT. Kiểm tra nhanh:
--   SELECT name, sort_order, is_lose FROM crm_stage_templates WHERE entity_type='lead' ORDER BY sort_order;
-- ════════════════════════════════════════════════════════════════════════════
