-- Migration: Lead workflow Bitrix24 style
-- 1. Đổi tên stage cuối "Không tiềm năng" → "Hoàn thành"
-- 2. Fix is_win/is_lose cho tất cả lead stages
-- 3. Thêm cột completion vào crm_leads

-- ═══════════════════════════════════════
-- 1. Cập nhật Lead Stage Templates
-- ═══════════════════════════════════════

-- Đổi "Không tiềm năng" → "Hoàn thành" (stage cuối, nơi sale quyết định kết quả)
UPDATE crm_stage_templates
SET name = 'Hoàn thành', 
    color = '#8B5CF6',   -- Purple for completion
    is_win = false, 
    is_lose = false
WHERE entity_type = 'lead' AND (name = 'Không tiềm năng' OR name = 'Thất bại');

-- Fix "Phân loại tiềm năng cao" — không nên is_win vì chưa phải deal
UPDATE crm_stage_templates
SET is_win = false
WHERE entity_type = 'lead' AND name LIKE '%tiềm năng cao%';

-- Đảm bảo tất cả lead stages đều is_win = false, is_lose = false
-- (vì win/lose giờ được xác định bởi completion_result, không phải stage)
UPDATE crm_stage_templates
SET is_win = false, is_lose = false
WHERE entity_type = 'lead';

-- ═══════════════════════════════════════
-- 2. Thêm cột completion vào crm_leads
-- ═══════════════════════════════════════

ALTER TABLE crm_leads 
  ADD COLUMN IF NOT EXISTS completion_result TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completion_note TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_opportunity BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

-- Index for filtering by completion status
CREATE INDEX IF NOT EXISTS idx_crm_leads_is_opportunity ON crm_leads(is_opportunity) WHERE is_opportunity IS NOT NULL;

COMMENT ON COLUMN crm_leads.completion_result IS 'Kết quả xử lý Lead: deal+contact+company, deal+contact, deal+company, deal, contact+company, contact, company, not_opportunity';
COMMENT ON COLUMN crm_leads.completion_note IS 'Ghi chú khi hoàn thành (bắt buộc nếu not_opportunity)';
COMMENT ON COLUMN crm_leads.is_opportunity IS 'true = tạo entities, false = không phải cơ hội, null = chưa hoàn thành';
COMMENT ON COLUMN crm_leads.completed_at IS 'Thời điểm hoàn thành Lead';
