-- =============================================
-- Task Templates Redesign — Thêm entity types, category, is_active
-- =============================================

-- 1. Thêm cột mới cho task_templates
ALTER TABLE task_templates 
ADD COLUMN IF NOT EXISTS applicable_entity_types text[] DEFAULT '{}';

ALTER TABLE task_templates 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

ALTER TABLE task_templates 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Thêm entity types còn thiếu
INSERT INTO entity_registry (entity_type, label, icon, color, url_pattern) VALUES
  ('invoice', 'Hóa đơn', 'Receipt', '#f97316', '/finance?tab=invoices&id=:id'),
  ('supplier', 'Nhà cung cấp', 'Truck', '#8b5cf6', '/customers/:id'),
  ('manufacturer', 'Hãng sản xuất', 'Factory', '#06b6d4', '/customers/:id'),
  ('project', 'Dự án', 'FolderKanban', '#10b981', '/projects/:id')
ON CONFLICT (entity_type) DO NOTHING;
