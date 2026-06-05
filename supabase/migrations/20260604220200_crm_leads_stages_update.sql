-- Rename stages cũ sang tên mới
UPDATE crm_stage_templates SET name = 'Mới', color = '#93C5FD', sort_order = 1
WHERE entity_type = 'lead' AND name = 'Đầu mối mới khởi tạo';

UPDATE crm_stage_templates SET name = 'Đang xử lý', color = '#60A5FA', sort_order = 2
WHERE entity_type = 'lead' AND name = 'Phân loại tiềm năng thấp';

UPDATE crm_stage_templates SET name = 'Đã liên hệ', color = '#3B82F6', sort_order = 3
WHERE entity_type = 'lead' AND name = 'Phân loại tiềm năng cao';

-- Insert stages mới
INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
VALUES ('lead', 'Đủ điều kiện', '#1D4ED8', 4, false, false)
ON CONFLICT DO NOTHING;

UPDATE crm_stage_templates SET name = 'Chuyển đổi', color = '#8B5CF6', sort_order = 5
WHERE entity_type = 'lead' AND name = 'Hoàn thành';

INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
VALUES ('lead', 'Không đủ ĐK', '#F87171', 6, false, true)
ON CONFLICT DO NOTHING;

INSERT INTO crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose)
VALUES ('lead', 'Mất', '#6B7280', 7, false, true)
ON CONFLICT DO NOTHING;

-- Update sort_order cho tất cả stages
UPDATE crm_stage_templates SET sort_order = 1 WHERE entity_type = 'lead' AND name = 'Mới';
UPDATE crm_stage_templates SET sort_order = 2 WHERE entity_type = 'lead' AND name = 'Đang xử lý';
UPDATE crm_stage_templates SET sort_order = 3 WHERE entity_type = 'lead' AND name = 'Đã liên hệ';
UPDATE crm_stage_templates SET sort_order = 4 WHERE entity_type = 'lead' AND name = 'Đủ điều kiện';
UPDATE crm_stage_templates SET sort_order = 5 WHERE entity_type = 'lead' AND name = 'Chuyển đổi';
UPDATE crm_stage_templates SET sort_order = 6 WHERE entity_type = 'lead' AND name = 'Không đủ ĐK';
UPDATE crm_stage_templates SET sort_order = 7 WHERE entity_type = 'lead' AND name = 'Mất';
