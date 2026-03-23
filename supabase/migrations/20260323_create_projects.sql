-- Migration: Create projects table for BIM Consulting Projects
-- Created at: 2026-03-23

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT '30_CHUANBI',
  location TEXT,
  progress NUMERIC NOT NULL DEFAULT 0,
  client_name TEXT,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  description TEXT,
  contract_value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_unit_id ON projects(unit_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can view all projects
CREATE POLICY "projects_select_all" ON projects
  FOR SELECT TO authenticated
  USING (true);

-- Policy: authenticated users can insert projects
CREATE POLICY "projects_insert_auth" ON projects
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Policy: authenticated users can update projects
CREATE POLICY "projects_update_auth" ON projects
  FOR UPDATE TO authenticated
  USING (true);

-- Policy: authenticated users can delete projects
CREATE POLICY "projects_delete_auth" ON projects
  FOR DELETE TO authenticated
  USING (true);

-- Seed sample data
INSERT INTO projects (code, name, thumbnail_url, status, location, progress, client_name, contract_value, start_date, description) VALUES
  ('CIC-BIM-001', 'Cải tạo, nâng cấp sân vận động Thống Nhất', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=340&fit=crop', '30_CHUANBI', 'Phường Điện Biên Phủ, Thành phố Hồ Chí Minh', 0, 'Ban QLDA TP.HCM', 319900, '2026-01-15', 'Dự án cải tạo và nâng cấp toàn bộ hạ tầng sân vận động Thống Nhất'),
  ('CIC-BIM-002', 'Xây dựng Khu trung tâm nghiên cứu ứng dụng Đông Y - Đông Dược', 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&h=340&fit=crop', '40_THAMDINH', 'Phường Phú Nhuận, Thành phố Hồ Chí Minh', 16, 'Sở Y tế TP.HCM', 450000, '2025-09-01', 'Xây dựng khu trung tâm nghiên cứu Y học cổ truyền'),
  ('CIC-BIM-003', 'Xây dựng mới Bệnh viện Đa khoa khu vực Hóc Môn', 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&h=340&fit=crop', '50_HOTROQLDA', 'Xã Hóc Môn, Thành phố Hồ Chí Minh', 100, 'Sở Y tế TP.HCM', 1895000, '2024-03-10', 'Xây mới bệnh viện đa khoa quy mô 500 giường'),
  ('CIC-BIM-004', 'Xây dựng mới Khối bệnh nhiệt đới và Nghiên cứu Bệnh viện Nhi đồng 2', 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&h=340&fit=crop', '50_HOTROQLDA', 'Phường Sài Gòn, Thành phố Hồ Chí Minh', 46, 'BV Nhi Đồng 2', 788800, '2025-01-20', 'Mở rộng khối bệnh nhiệt đới trong khuôn viên bệnh viện Nhi đồng 2'),
  ('CIC-BIM-005', 'Xây dựng mới khối nhà A2 - Bệnh viện PHCN - Điều trị bệnh nghề nghiệp', 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=600&h=340&fit=crop', '45_KIEMTRA', 'Phường Chánh Hưng, Thành phố Hồ Chí Minh', 0, 'BV PHCN TP.HCM', 364000, '2025-06-15', 'Xây dựng khối nhà A2 mở rộng'),
  ('CIC-BIM-006', 'Xây dựng Ngân hàng Máu', 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=340&fit=crop', '60_THANHQUYETTOAN', 'Xã Tân Nhựt, Thành phố Hồ Chí Minh', 16, 'Sở Y tế TP.HCM', 699500, '2024-11-01', 'Xây dựng trung tâm ngân hàng máu khu vực phía Nam'),
  ('CIC-BIM-007', 'Xây mới khu C Bệnh viện Nguyễn Tri Phương', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=340&fit=crop', '70_LUUTRU', 'Phường An Đông, Thành phố Hồ Chí Minh', 0, 'BV Nguyễn Tri Phương', 520000, '2023-05-10', 'Xây dựng mới khu C trong khuôn viên bệnh viện');
