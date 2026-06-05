-- ════════════════════════════════════════════════════════════════════════════
-- CRM LEAD — Gộp pipeline stage 7 → 4 (idempotent)
--   Mới → Đang xử lý → Tiềm năng cao (win) → Không tiềm năng (lose)
--
--   Gộp:  Đã liên hệ + Đủ điều kiện  → Đang xử lý
--         Chuyển đổi / Hoàn thành     → Tiềm năng cao (is_win)
--         Không đủ ĐK + Mất / Thất bại → Không tiềm năng (is_lose)
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Remap leads ra khỏi các stage sắp bị xoá, gom vào stage còn lại.
--    (Phải chạy TRƯỚC khi đổi tên/xoá để FK stage_id luôn hợp lệ.)
UPDATE crm_leads SET stage_id = (
  SELECT id FROM crm_stage_templates
  WHERE entity_type = 'lead' AND name = 'Đang xử lý' LIMIT 1)
WHERE stage_id IN (
  SELECT id FROM crm_stage_templates
  WHERE entity_type = 'lead' AND name IN ('Đã liên hệ', 'Đủ điều kiện'));

UPDATE crm_leads SET stage_id = (
  SELECT id FROM crm_stage_templates
  WHERE entity_type = 'lead' AND name = 'Không đủ ĐK' LIMIT 1)
WHERE stage_id IN (
  SELECT id FROM crm_stage_templates
  WHERE entity_type = 'lead' AND name IN ('Mất', 'Thất bại'));

-- 2. Xoá các stage thừa.
DELETE FROM crm_stage_templates
WHERE entity_type = 'lead' AND name IN ('Đã liên hệ', 'Đủ điều kiện', 'Mất', 'Thất bại');

-- 3. Đổi tên + thuộc tính các stage còn lại.
UPDATE crm_stage_templates
SET name = 'Tiềm năng cao', color = '#22C55E', sort_order = 3, is_win = false, is_lose = false
WHERE entity_type = 'lead' AND name IN ('Chuyển đổi', 'Hoàn thành');

UPDATE crm_stage_templates
SET name = 'Không tiềm năng', color = '#6B7280', sort_order = 4, is_win = false, is_lose = true
WHERE entity_type = 'lead' AND name = 'Không đủ ĐK';

UPDATE crm_stage_templates
SET color = '#93C5FD', sort_order = 1, is_win = false, is_lose = false
WHERE entity_type = 'lead' AND name = 'Mới';

UPDATE crm_stage_templates
SET color = '#60A5FA', sort_order = 2, is_win = false, is_lose = false
WHERE entity_type = 'lead' AND name = 'Đang xử lý';

-- 4. Bảo hiểm: nếu DB chưa từng có đủ 4 stage (vd seed cũ), insert phần còn thiếu.
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
SELECT 'lead', 'Mới', '#93C5FD', 1, false, false
WHERE NOT EXISTS (SELECT 1 FROM crm_stage_templates WHERE entity_type='lead' AND name='Mới');
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
SELECT 'lead', 'Đang xử lý', '#60A5FA', 2, false, false
WHERE NOT EXISTS (SELECT 1 FROM crm_stage_templates WHERE entity_type='lead' AND name='Đang xử lý');
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
SELECT 'lead', 'Tiềm năng cao', '#22C55E', 3, false, false
WHERE NOT EXISTS (SELECT 1 FROM crm_stage_templates WHERE entity_type='lead' AND name='Tiềm năng cao');
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
SELECT 'lead', 'Không tiềm năng', '#6B7280', 4, false, true
WHERE NOT EXISTS (SELECT 1 FROM crm_stage_templates WHERE entity_type='lead' AND name='Không tiềm năng');

-- Kiểm tra: SELECT name, sort_order, is_win, is_lose FROM crm_stage_templates
--           WHERE entity_type='lead' ORDER BY sort_order;
