-- ============================================================
-- DB Migration: Cập nhật RLS và Seed danh mục cho Web Posts
-- ============================================================

-- 1. Insert required categories if not exists
INSERT INTO post_categories (id, name, slug, description)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Tin tức chung', 'tin-tuc-chung', 'Các tin tức chung về CIC'),
    ('22222222-2222-2222-2222-222222222222', 'Sự kiện', 'su-kien', 'Sự kiện sắp diễn ra hoặc đã tổ chức'),
    ('33333333-3333-3333-3333-333333333333', 'Báo chí', 'bao-chi', 'Báo chí nói về CIC'),
    ('44444444-4444-4444-4444-444444444444', 'Thông báo', 'thong-bao', 'Thông báo nội bộ và bên ngoài')
ON CONFLICT (slug) DO NOTHING;

-- 2. Add authenticated rules for web_posts
DROP POLICY IF EXISTS "Allow authenticated users full access to web_posts" ON web_posts;
CREATE POLICY "Allow authenticated users full access to web_posts" 
    ON web_posts 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 3. Add authenticated rules for post_categories
DROP POLICY IF EXISTS "Allow authenticated users full access to post_categories" ON post_categories;
CREATE POLICY "Allow authenticated users full access to post_categories" 
    ON post_categories 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- 4. Add authenticated rules for product_categories
DROP POLICY IF EXISTS "Allow authenticated users full access to product_categories" ON product_categories;
CREATE POLICY "Allow authenticated users full access to product_categories" 
    ON product_categories 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
