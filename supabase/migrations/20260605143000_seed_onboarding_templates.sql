-- ============================================================
-- Seed Onboarding Templates & Tasks, and setup RLS Policies
-- ============================================================

-- Enable RLS
ALTER TABLE IF EXISTS onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS onboarding_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow authenticated access" ON onboarding_templates;
DROP POLICY IF EXISTS "Allow authenticated access" ON onboarding_tasks;
DROP POLICY IF EXISTS "Allow authenticated access" ON onboarding_checklists;
DROP POLICY IF EXISTS "Allow authenticated access" ON onboarding_checklist_items;

-- Create policies for all operations
CREATE POLICY "Allow authenticated access" ON onboarding_templates FOR ALL USING (true);
CREATE POLICY "Allow authenticated access" ON onboarding_tasks FOR ALL USING (true);
CREATE POLICY "Allow authenticated access" ON onboarding_checklists FOR ALL USING (true);
CREATE POLICY "Allow authenticated access" ON onboarding_checklist_items FOR ALL USING (true);

-- Seed Onboarding Template
INSERT INTO onboarding_templates (id, name, description, is_default, position)
VALUES 
  ('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Mẫu Quy trình Hội nhập chuẩn (Toàn công ty)', 'Mẫu quy trình hội nhập áp dụng chung cho tất cả các vị trí nhân sự mới gia nhập công ty.', true, NULL)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, is_default = EXCLUDED.is_default;

-- Seed Template Tasks
INSERT INTO onboarding_tasks (id, template_id, title, description, assignee_role, due_days, sort_order, category)
VALUES
  ('b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Chuẩn bị bàn làm việc, máy tính & tài khoản phần mềm', 'IT chuẩn bị trang thiết bị làm việc bao gồm laptop, màn hình phụ, chuột bàn phím, setup tài khoản email công ty và tài khoản ERP.', 'it', 0, 10, 'setup'),
  ('c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Ký kết hồ sơ thử việc & hướng dẫn các thủ tục hành chính', 'HR bàn giao và hướng dẫn ký kết Hợp đồng thử việc, khai báo thông tin hồ sơ nhân sự, đăng ký vân tay và phổ biến quy chế.', 'hr', 0, 20, 'documents'),
  ('d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Giới thiệu thành viên mới & sơ đồ tổ chức phòng ban', 'Manager giới thiệu nhân sự mới với team, đi tham quan các phòng ban và giới thiệu sơ đồ tổ chức công ty.', 'manager', 0, 30, 'orientation'),
  ('e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Cài đặt môi trường phát triển / Công cụ làm việc riêng', 'Nhân sự mới chủ động cài đặt các phần mềm, IDE cần thiết, clone source code dự án hoặc cấu hình các công cụ đặc thù theo vị trí.', 'new_hire', 1, 40, 'setup'),
  ('f1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Gặp gỡ người hướng dẫn (Buddy) & Lập kế hoạch 30 ngày', 'Gặp gỡ Buddy được phân công, thảo luận về mục tiêu công việc thử việc trong tháng đầu tiên và kế hoạch đào tạo.', 'buddy', 1, 50, 'training'),
  ('a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Hoàn thành bài đọc văn hóa công ty & Hướng dẫn sử dụng hệ thống', 'Đọc tài liệu về sứ mệnh, tầm nhìn, quy tắc ứng xử của CIC và hướng dẫn sử dụng phần mềm CIC ERP nội bộ.', 'new_hire', 3, 60, 'training'),
  ('b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Đánh giá kết quả thử việc tháng thứ nhất', 'Manager họp review đánh giá tiến độ và hiệu quả công việc sau 30 ngày thử việc đầu tiên của nhân sự.', 'manager', 30, 70, 'evaluation')
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title, description = EXCLUDED.description, assignee_role = EXCLUDED.assignee_role, due_days = EXCLUDED.due_days, sort_order = EXCLUDED.sort_order, category = EXCLUDED.category;
