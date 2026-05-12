-- ==============================================================================
-- Migration: HRM Facilities (Cơ sở vật chất)
-- Description: Create facilities table and link with internal_requests
-- ==============================================================================

-- 1. Facilities Table
CREATE TABLE public.facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,           -- "Phòng họp 1", "Xe 30A-12345"
    type VARCHAR(50) NOT NULL,            -- 'meeting_room', 'vehicle'
    description TEXT,
    capacity INT,                          -- Sức chứa
    location VARCHAR(255),                 -- Vị trí
    metadata JSONB DEFAULT '{}'::jsonb,    -- Mở rộng: biển số, tài xế...
    is_active BOOLEAN DEFAULT true,
    color VARCHAR(20),                     -- Màu hiển thị trên lịch
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Triggers for updated_at
CREATE TRIGGER update_facilities_updated_at
    BEFORE UPDATE ON public.facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Enable RLS
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Mọi người có thể xem danh sách CSVC đang active
CREATE POLICY "Users can read active facilities" ON public.facilities
    FOR SELECT USING (is_active = true OR auth.jwt()->>'role' = 'Admin');

-- Chỉ Admin mới có quyền thêm/sửa/xóa CSVC
CREATE POLICY "Admins can insert facilities" ON public.facilities
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE email = auth.jwt()->>'email' AND role = 'Admin'
        )
    );

CREATE POLICY "Admins can update facilities" ON public.facilities
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE email = auth.jwt()->>'email' AND role = 'Admin'
        )
    );

CREATE POLICY "Admins can delete facilities" ON public.facilities
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.employees 
            WHERE email = auth.jwt()->>'email' AND role = 'Admin'
        )
    );


-- 2. Update Internal Requests
ALTER TABLE public.internal_requests
    ADD COLUMN facility_id UUID REFERENCES public.facilities(id);

CREATE INDEX idx_internal_requests_facility ON public.internal_requests(facility_id);

-- 3. Seed Dữ liệu ban đầu
INSERT INTO public.facilities (name, type, capacity, location, color) VALUES
  ('Phòng họp 1', 'meeting_room', 20, 'Tầng 3', '#3b82f6'),
  ('Phòng họp 2', 'meeting_room', 10, 'Tầng 5', '#8b5cf6'),
  ('Xe 30A-12345', 'vehicle', 7, NULL, '#10b981');
