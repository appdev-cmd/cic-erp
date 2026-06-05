-- ════════════════════════════════════════════════════════════════════════════
-- CRM LEAD — Mức tiềm năng + thông tin chuyển đổi + ao "Không tiềm năng"
--   • potential_level: phân loại trong stage "Đang xử lý"
--   • address / contact_position: bắt buộc khi sang "Tiềm năng cao"
--   • pg_cron: tự xoá lead "Không tiềm năng" sau 30 ngày
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Cột bổ sung
ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS potential_level  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS address          TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_position TEXT DEFAULT NULL,
  -- Lưu ghi chú gần nhất theo từng trạng thái/mức đã chuyển (key = tên stage hoặc 'level:<mức>')
  -- để điền sẵn khi quay lại trạng thái đã từng qua.
  ADD COLUMN IF NOT EXISTS transition_notes JSONB DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_leads_potential_level_check') THEN
    ALTER TABLE crm_leads ADD CONSTRAINT crm_leads_potential_level_check
      CHECK (potential_level IS NULL OR potential_level IN ('very_low','low','medium','high','none'));
  END IF;
END $$;

-- 2. "Tiềm năng cao" là stage hoạt động (không phải closed-won) → is_win=false
UPDATE crm_stage_templates
SET is_win = false
WHERE entity_type = 'lead' AND name = 'Tiềm năng cao';

-- 3. Hàm purge: xoá lead trong stage lose ("Không tiềm năng") quá 30 ngày kể từ completed_at
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

-- 4. Lên lịch chạy hằng ngày 03:00 qua pg_cron (bỏ qua nếu extension chưa bật được).
--    Nếu báo lỗi quyền: bật pg_cron ở Supabase Dashboard › Database › Extensions rồi chạy lại.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Gỡ job cũ (nếu có) để idempotent
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-purge-no-potential') THEN
    PERFORM cron.unschedule('crm-purge-no-potential');
  END IF;

  PERFORM cron.schedule(
    'crm-purge-no-potential',
    '0 3 * * *',
    $cron$ SELECT crm_purge_stale_no_potential_leads(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron chưa sẵn sàng (%) — hàm crm_purge_stale_no_potential_leads() vẫn dùng được, hãy bật pg_cron và lên lịch thủ công.', SQLERRM;
END $$;
