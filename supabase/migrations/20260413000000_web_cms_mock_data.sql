-- Tạo các bảng lưu trữ CMS Data cho Corporate Web

-- 1. Domains/Features
CREATE TABLE IF NOT EXISTS public.cms_product_domains (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    icon_name text NOT NULL,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cms_product_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access cms_product_domains" ON public.cms_product_domains FOR SELECT USING (true);


-- 2. Milestones
CREATE TABLE IF NOT EXISTS public.cms_milestones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    year text NOT NULL,
    event text NOT NULL,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cms_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access cms_milestones" ON public.cms_milestones FOR SELECT USING (true);


-- 3. Core Values
CREATE TABLE IF NOT EXISTS public.cms_core_values (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cms_core_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access cms_core_values" ON public.cms_core_values FOR SELECT USING (true);


-- 4. Nav Items
CREATE TABLE IF NOT EXISTS public.cms_nav_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    href text NOT NULL,
    parent_id uuid REFERENCES public.cms_nav_items(id) ON DELETE CASCADE,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cms_nav_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access cms_nav_items" ON public.cms_nav_items FOR SELECT USING (true);


-- 5. CMS Settings (if not exists)
CREATE TABLE IF NOT EXISTS public.cms_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read Access cms_settings') THEN
        CREATE POLICY "Public Read Access cms_settings" ON public.cms_settings FOR SELECT USING (true);
    END IF;
END $$;


-- ==========================================
-- INSERT SEED DATA
-- ==========================================

-- Product Domains
INSERT INTO public.cms_product_domains (title, description, icon_name, sort_order) VALUES
('Xây dựng dân dụng & Công nghiệp', 'Phần mềm dự toán, thiết kế kết cấu, quản lý dự án cho công trình dân dụng và công nghiệp.', 'Building2', 1),
('Giao thông & Cầu đường', 'Giải pháp thiết kế tuyến đường, cầu, hầm và hạ tầng giao thông đô thị hiện đại.', 'Route', 2),
('Thuỷ lợi & Thuỷ điện', 'Công cụ tính toán thuỷ lực, thiết kế đập, kênh mương và hệ thống tưới tiêu thông minh.', 'Droplets', 3),
('Khai khoáng & Dầu khí', 'Phần mềm chuyên dụng cho ngành khai thác khoáng sản và công trình dầu khí.', 'Gem', 4),
('Môi trường & ESG', 'Giải pháp đánh giá tác động môi trường, kiểm kê khí nhà kính và báo cáo ESG.', 'Zap', 5),
('Cơ khí chế tạo', 'Công cụ thiết kế, dự toán cho ngành cơ khí chế tạo máy và thiết bị công nghiệp.', 'Wrench', 6);

-- Milestones
INSERT INTO public.cms_milestones (year, event, sort_order) VALUES
('1990', 'Thành lập Trung tâm Tin học Xây dựng', 1),
('2000', 'Ra mắt bộ phần mềm dự toán xây dựng đầu tiên', 2),
('2010', 'Vượt mốc 5,000 khách hàng doanh nghiệp', 3),
('2018', 'Triển khai tư vấn BIM cho các dự án trọng điểm quốc gia', 4),
('2024', 'Ra mắt nền tảng CDE và ERP quản lý dự án số', 5),
('2026', 'Vinh danh TOP 10 thương hiệu phần mềm Việt Nam', 6);

-- Core Values
INSERT INTO public.cms_core_values (title, description, sort_order) VALUES
('Sứ mệnh', 'Số hoá ngành xây dựng Việt Nam bằng các giải pháp phần mềm chuyên sâu, giúp doanh nghiệp nâng cao năng suất và chất lượng công trình.', 1),
('Tầm nhìn', 'Trở thành nhà cung cấp giải pháp công nghệ xây dựng hàng đầu khu vực Đông Nam Á vào năm 2030.', 2),
('Giá trị cốt lõi', 'Chất lượng — Đổi mới — Tận tâm. Mỗi sản phẩm đều được phát triển từ thực tiễn dự án và kiểm chứng bởi hàng ngàn kỹ sư.', 3);

-- Settings
INSERT INTO public.cms_settings (key, value) VALUES
('company_address_hn', '"VG Building, Số 235 Nguyễn Trãi, Phường Khương Đình, Quận Thanh Xuân, Hà Nội"'),
('company_phone_hn', '"024 3976 1381"'),
('company_address_hcm', '"Số 36 Nguyễn Huy Lượng, P. Bình Thạnh, TP. Hồ Chí Minh"'),
('company_phone_hcm', '"088 645 2020 - 028 628 99022"'),
('company_email', '"info@cic.com.vn"'),
('company_facebook_url', '"https://www.facebook.com/CICTechnologyandConsultancyVN/"'),
('company_youtube_url', '"https://www.youtube.com/channel/UCVrD2Lw1V96ggdwQNs87qEQ"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Navigation
DO $$
DECLARE
    gioi_thieu_id uuid;
    san_pham_id uuid;
    dich_vu_id uuid;
BEGIN
    -- Delete existing in case of re-run
    DELETE FROM public.cms_nav_items;

    INSERT INTO public.cms_nav_items (name, href, sort_order) VALUES ('Trang chủ', '/', 1);
    
    INSERT INTO public.cms_nav_items (name, href, sort_order) VALUES ('Giới thiệu', '/gioi-thieu', 2) RETURNING id INTO gioi_thieu_id;
    INSERT INTO public.cms_nav_items (name, href, parent_id, sort_order) VALUES
       ('Về chúng tôi', '/gioi-thieu', gioi_thieu_id, 1),
       ('Năng lực & kinh nghiệm', '/gioi-thieu#nang-luc', gioi_thieu_id, 2),
       ('Thành tựu đạt được', '/gioi-thieu#thanh-tuu', gioi_thieu_id, 3);
       
    INSERT INTO public.cms_nav_items (name, href, sort_order) VALUES ('Sản phẩm', '/san-pham', 3) RETURNING id INTO san_pham_id;
    INSERT INTO public.cms_nav_items (name, href, parent_id, sort_order) VALUES
       ('Xây dựng', '/san-pham?linhvuc=xay-dung', san_pham_id, 1),
       ('Giao thông', '/san-pham?linhvuc=giao-thong', san_pham_id, 2),
       ('Thuỷ lợi', '/san-pham?linhvuc=thuy-loi', san_pham_id, 3),
       ('Khai khoáng & Dầu khí', '/san-pham?linhvuc=dau-khi', san_pham_id, 4),
       ('Môi trường', '/san-pham?linhvuc=moi-truong', san_pham_id, 5),
       ('Cơ khí chế tạo', '/san-pham?linhvuc=co-khi', san_pham_id, 6),
       ('Điện lực', '/san-pham?linhvuc=dien-luc', san_pham_id, 7),
       ('Nội thất & VLXD', '/san-pham?linhvuc=noi-that', san_pham_id, 8);

    INSERT INTO public.cms_nav_items (name, href, sort_order) VALUES ('Dịch vụ', '/dich-vu', 4) RETURNING id INTO dich_vu_id;
    INSERT INTO public.cms_nav_items (name, href, parent_id, sort_order) VALUES
       ('Tư vấn BIM', '/dich-vu#tu-van-bim', dich_vu_id, 1),
       ('Tư vấn xây dựng', '/dich-vu#tu-van-xay-dung', dich_vu_id, 2),
       ('Tư vấn dự án', '/dich-vu#tu-van-du-an', dich_vu_id, 3),
       ('Giải pháp ngành thép', '/dich-vu#giai-phap-nganh-thep', dich_vu_id, 4),
       ('Khí nhà kính', '/dich-vu#khi-nha-kinh', dich_vu_id, 5),
       ('Web 360', '/dich-vu#web-360', dich_vu_id, 6);

    INSERT INTO public.cms_nav_items (name, href, sort_order) VALUES ('Tin tức', '/tin-tuc', 5);
    INSERT INTO public.cms_nav_items (name, href, sort_order) VALUES ('Tuyển dụng', '/tuyen-dung', 6);
    INSERT INTO public.cms_nav_items (name, href, sort_order) VALUES ('Liên hệ', '/lien-he', 7);
END $$;
