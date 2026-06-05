-- ════════════════════════════════════════════════════════════════
-- CRM Lead Auto-Assignment — Unit Pool routing + cân bằng tải
-- (Postgres-valid: không dùng cú pháp Oracle TYPE...IS RECORD / GOTO)
-- ════════════════════════════════════════════════════════════════

-- ── 1. Cột is_claimed (generated) ──────────────────────────────
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN
    GENERATED ALWAYS AS (assigned_to IS NOT NULL) STORED;

COMMENT ON COLUMN crm_leads.is_claimed IS
  'True khi đã có người nhận khai thác (assigned_to IS NOT NULL)';

-- ── 2. Bảng cấu hình phân công ─────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_unit_assignment_active
  ON crm_unit_assignment_config(is_active, priority DESC);

ALTER TABLE crm_unit_assignment_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_unit_assignment_config' AND policyname = 'uac_read') THEN
    CREATE POLICY "uac_read" ON crm_unit_assignment_config FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_unit_assignment_config' AND policyname = 'uac_write') THEN
    CREATE POLICY "uac_write" ON crm_unit_assignment_config FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 3. Bảng log phân công ──────────────────────────────────────
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_assignment_log' AND policyname = 'log_read') THEN
    CREATE POLICY "log_read" ON crm_assignment_log FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'crm_assignment_log' AND policyname = 'log_write') THEN
    CREATE POLICY "log_write" ON crm_assignment_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 4. Hàm phân công ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_lead_to_unit(p_lead_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_lead          crm_leads%ROWTYPE;
  v_unit_id       TEXT := NULL;
  v_customer_id   TEXT;
  v_lead_products TEXT[];
  v_region        TEXT;
  v_balance_threshold INT := 5;          -- ⚙️ ngưỡng cân bằng tải
  v_balance_window INTERVAL := '7 days'; -- ⚙️ cửa sổ thời gian
  v_candidates    TEXT[] := '{}';
  v_candidate_count INT := 0;
  v_min_count     INT;
  v_max_count     INT;
  v_balanced      BOOLEAN := false;
BEGIN
  SELECT * INTO v_lead FROM crm_leads WHERE id = p_lead_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_region := COALESCE(v_lead.region, 'unknown');

  -- products JSONB → TEXT[] (hỗ trợ cả mảng id chuỗi lẫn mảng object {productId})
  BEGIN
    v_lead_products := COALESCE(ARRAY(
      SELECT COALESCE(elem->>'productId', elem->>'product_id', trim(both '"' from elem::text))
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(v_lead.products) = 'array' THEN v_lead.products ELSE '[]'::jsonb END
      ) elem
    ), '{}'::TEXT[]);
  EXCEPTION WHEN others THEN
    v_lead_products := '{}'::TEXT[];
  END;

  -- ═══ BƯỚC 1: Khách hàng hiện hữu → continuity ═══
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

  -- ═══ BƯỚC 2: Matching sản phẩm × vùng + cân bằng tải ═══
  IF v_unit_id IS NULL THEN
    -- Danh sách ứng viên (lưu để log)
    SELECT COALESCE(ARRAY_AGG(uac.unit_id), '{}') INTO v_candidates
    FROM crm_unit_assignment_config uac
    WHERE uac.is_active
      AND (cardinality(uac.product_ids) = 0 OR cardinality(v_lead_products) = 0 OR uac.product_ids && v_lead_products)
      AND ('national' = ANY(uac.regions) OR cardinality(uac.regions) = 0 OR v_region = ANY(uac.regions) OR v_region = 'unknown');

    v_candidate_count := cardinality(v_candidates);

    IF v_candidate_count = 1 THEN
      v_unit_id := v_candidates[1];
    ELSIF v_candidate_count > 1 THEN
      -- Tải gần đây của từng ứng viên
      WITH cand AS (
        SELECT uac.unit_id, uac.priority,
          (SELECT COUNT(*) FROM crm_leads l
             WHERE l.unit_id = uac.unit_id AND l.created_at >= NOW() - v_balance_window) AS load
        FROM crm_unit_assignment_config uac
        WHERE uac.is_active
          AND (cardinality(uac.product_ids) = 0 OR cardinality(v_lead_products) = 0 OR uac.product_ids && v_lead_products)
          AND ('national' = ANY(uac.regions) OR cardinality(uac.regions) = 0 OR v_region = ANY(uac.regions) OR v_region = 'unknown')
      )
      SELECT MIN(load), MAX(load) INTO v_min_count, v_max_count FROM cand;

      IF (v_max_count - v_min_count) > v_balance_threshold THEN
        v_balanced := true;
        -- ⚖️ Mất cân bằng → đơn vị ít lead nhất (tie: priority cao nhất)
        WITH cand AS (
          SELECT uac.unit_id, uac.priority,
            (SELECT COUNT(*) FROM crm_leads l
               WHERE l.unit_id = uac.unit_id AND l.created_at >= NOW() - v_balance_window) AS load
          FROM crm_unit_assignment_config uac
          WHERE uac.is_active
            AND (cardinality(uac.product_ids) = 0 OR cardinality(v_lead_products) = 0 OR uac.product_ids && v_lead_products)
            AND ('national' = ANY(uac.regions) OR cardinality(uac.regions) = 0 OR v_region = ANY(uac.regions) OR v_region = 'unknown')
        )
        SELECT unit_id INTO v_unit_id FROM cand
        WHERE load = (SELECT MIN(load) FROM cand)
        ORDER BY priority DESC LIMIT 1;
      ELSE
        -- ✅ Cân bằng → priority cao nhất
        SELECT uac.unit_id INTO v_unit_id
        FROM crm_unit_assignment_config uac
        WHERE uac.is_active
          AND (cardinality(uac.product_ids) = 0 OR cardinality(v_lead_products) = 0 OR uac.product_ids && v_lead_products)
          AND ('national' = ANY(uac.regions) OR cardinality(uac.regions) = 0 OR v_region = ANY(uac.regions) OR v_region = 'unknown')
        ORDER BY uac.priority DESC LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- ═══ BƯỚC 3: Fallback → đơn vị mặc định ═══
  IF v_unit_id IS NULL THEN
    SELECT unit_id INTO v_unit_id FROM crm_unit_assignment_config
    WHERE is_default AND is_active LIMIT 1;
  END IF;

  -- ═══ Ghi nhận ═══
  IF v_unit_id IS NOT NULL THEN
    UPDATE crm_leads SET unit_id = v_unit_id, updated_at = NOW() WHERE id = p_lead_id;
    INSERT INTO crm_assignment_log (lead_id, assigned_unit_id, candidate_units, balance_triggered)
    VALUES (p_lead_id, v_unit_id, v_candidates, v_balanced);
  END IF;

  RETURN v_unit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Trigger tự động phân công khi tạo lead chưa có unit ──────
CREATE OR REPLACE FUNCTION trigger_auto_assign_lead()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unit_id IS NULL THEN
    PERFORM assign_lead_to_unit(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_assign_lead ON crm_leads;
CREATE TRIGGER trg_auto_assign_lead
AFTER INSERT ON crm_leads
FOR EACH ROW EXECUTE FUNCTION trigger_auto_assign_lead();

-- ── 6. View thống kê cân bằng tải 7/30 ngày ────────────────────
CREATE OR REPLACE VIEW crm_assignment_balance_stats AS
SELECT
  u.id   AS unit_id,
  u.name AS unit_name,
  u.code AS unit_code,
  COUNT(l.id) FILTER (WHERE l.created_at >= NOW() - INTERVAL '7 days')  AS leads_7d,
  COUNT(l.id) FILTER (WHERE l.created_at >= NOW() - INTERVAL '30 days') AS leads_30d,
  (SELECT COUNT(*) FROM crm_assignment_log al
     WHERE al.assigned_unit_id = u.id
       AND al.balance_triggered = true
       AND al.assigned_at >= NOW() - INTERVAL '7 days')                 AS balance_redirects_7d
FROM units u
LEFT JOIN crm_leads l ON l.unit_id = u.id
GROUP BY u.id, u.name, u.code
ORDER BY leads_7d DESC;
