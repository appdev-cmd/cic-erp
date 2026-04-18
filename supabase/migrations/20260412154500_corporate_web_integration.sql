-- ============================================================
-- DB Migration: Corporate Website Data Integration
-- Enables Next.js frontend to fetch single-source-of-truth data
-- Add product_categories, web_posts, post_categories and extend products, projects, job_openings.
-- ============================================================

-- 1. Product Categories (Replaces manual string entry)
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Post Categories
CREATE TABLE IF NOT EXISTS post_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Web Posts (News & Events)
CREATE TABLE IF NOT EXISTS web_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT,
    thumbnail_url TEXT,
    author_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    category_id UUID REFERENCES post_categories(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    seo_title VARCHAR(255),
    seo_description TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Alter existing tables

-- A. Products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
    ADD COLUMN IF NOT EXISTS gallery_urls TEXT[],
    ADD COLUMN IF NOT EXISTS content TEXT,
    ADD COLUMN IF NOT EXISTS is_published_web BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- B. Projects
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS content TEXT,
    ADD COLUMN IF NOT EXISTS gallery_urls TEXT[],
    ADD COLUMN IF NOT EXISTS is_published_web BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_featured_web BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- C. Job Openings
ALTER TABLE job_openings
    ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS location VARCHAR(255),
    ADD COLUMN IF NOT EXISTS is_published_web BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- 5. RLS Policies
-- Bật RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_posts ENABLE ROW LEVEL SECURITY;

-- Allow public (anon/authenticated) to read ALL categories
CREATE POLICY "Allow public read access to product categories" ON product_categories FOR SELECT USING (true);
CREATE POLICY "Allow public read access to post categories" ON post_categories FOR SELECT USING (true);

-- Allow public read access to published posts
CREATE POLICY "Allow public read access to published web posts" ON web_posts FOR SELECT USING (is_published = true);

-- Create policies for existing tables to allow anon reads when published
-- Note: 'anon' and 'authenticated' roles will both hit this policy
CREATE POLICY "Allow public read access to published products" ON products FOR SELECT USING (is_published_web = true);
CREATE POLICY "Allow public read access to published projects" ON projects FOR SELECT USING (is_published_web = true);
CREATE POLICY "Allow public read access to published jobs" ON job_openings FOR SELECT USING (is_published_web = true);

-- 6. Tích hợp nộp hồ sơ (RPC) từ Public Website
-- SECURITY DEFINER giúp bỏ qua RLS vì người nộp đơn (anon) bình thường không có quyền INSERT trực tiếp
CREATE OR REPLACE FUNCTION submit_job_application(
    p_job_opening_id UUID,
    p_full_name VARCHAR,
    p_email VARCHAR,
    p_phone VARCHAR,
    p_resume_url TEXT,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_candidate_id UUID;
    v_application_id UUID;
    v_status VARCHAR;
    v_is_published BOOLEAN;
BEGIN
    -- 1. Kiểm tra Job có đang mở không
    SELECT status, is_published_web INTO v_status, v_is_published 
    FROM job_openings 
    WHERE id = p_job_opening_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Tin tuyển dụng không tồn tại.';
    END IF;

    IF v_status != 'open' OR v_is_published = false THEN
        RAISE EXCEPTION 'Vị trí này đã đóng hoặc ngừng tuyển dụng.';
    END IF;

    -- 2. Tìm kiếm ứng viên qua email
    SELECT id INTO v_candidate_id FROM candidates WHERE email = p_email LIMIT 1;
    
    -- Nếu chưa có, tạo ứng viên mới
    IF v_candidate_id IS NULL THEN
        INSERT INTO candidates (full_name, email, phone, resume_url, source, notes)
        VALUES (p_full_name, p_email, p_phone, p_resume_url, 'website', p_notes)
        RETURNING id INTO v_candidate_id;
    ELSE
        -- Nếu đã có, cập nhật thêm notes hoặc resume nếu cần (tùy nghiệp vụ)
        UPDATE candidates SET notes = COALESCE(notes, '') || E'\n[Web Application]: ' || COALESCE(p_notes, '')
        WHERE id = v_candidate_id;
    END IF;

    -- 3. Tạo hồ sơ ứng tuyển
    IF EXISTS (SELECT 1 FROM applications WHERE candidate_id = v_candidate_id AND job_opening_id = p_job_opening_id) THEN
        RAISE EXCEPTION 'Bạn đã ứng tuyển vị trí này trước đó.';
    END IF;

    INSERT INTO applications (candidate_id, job_opening_id, stage)
    VALUES (v_candidate_id, p_job_opening_id, 'applied')
    RETURNING id INTO v_application_id;

    RETURN jsonb_build_object('success', true, 'application_id', v_application_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cấp quyền truy cập cho Role ẩn danh và xác thực
GRANT EXECUTE ON FUNCTION submit_job_application(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT) TO public;
GRANT EXECUTE ON FUNCTION submit_job_application(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_job_application(UUID, VARCHAR, VARCHAR, VARCHAR, TEXT, TEXT) TO authenticated;

-- 7. Trigger thiết lập Auto Updated_At cho các bảng mới
CREATE OR REPLACE FUNCTION update_corporate_web_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_categories_updated_at
    BEFORE UPDATE ON product_categories
    FOR EACH ROW EXECUTE FUNCTION update_corporate_web_updated_at();

CREATE TRIGGER post_categories_updated_at
    BEFORE UPDATE ON post_categories
    FOR EACH ROW EXECUTE FUNCTION update_corporate_web_updated_at();

CREATE TRIGGER web_posts_updated_at
    BEFORE UPDATE ON web_posts
    FOR EACH ROW EXECUTE FUNCTION update_corporate_web_updated_at();
