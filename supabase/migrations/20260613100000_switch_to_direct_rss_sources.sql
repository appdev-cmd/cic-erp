-- ============================================================================
-- Tech Intel: Chuyển nguồn tin từ Google News search → RSS publisher trực tiếp
-- Lý do: URL Google News là redirect mã hoá, decode server-side bị Google chặn
-- khi chạy số lượng lớn → không lấy được content. RSS trực tiếp trả link gốc thật
-- (cào/Jina được) và nhiều feed có sẵn full content qua <content:encoded>.
-- ============================================================================

-- 1) Tắt toàn bộ nguồn Google News search (giữ lại để tham khảo, không xoá)
UPDATE tech_sources SET is_active = false, updated_at = now()
WHERE type = 'google_news';

-- 2) Thêm/kích hoạt các nguồn RSS trực tiếp đã kiểm chứng (link gốc thật)
--    Nhiều nguồn có <content:encoded> = full content ngay trong feed.
INSERT INTO tech_sources (name, url, type, language, country, category, is_active) VALUES
  -- Có full content:encoded trong feed
  ('Dezeen',                     'https://www.dezeen.com/feed/',                       'rss', 'en', 'GB', 'architecture',  true),
  ('PBC Today',                  'https://www.pbctoday.co.uk/news/feed/',              'rss', 'en', 'GB', 'construction',  true),
  ('Global Construction Review', 'https://www.globalconstructionreview.com/feed/',     'rss', 'en', 'GB', 'construction',  true),
  ('Construction Enquirer',      'https://www.constructionenquirer.com/feed/',         'rss', 'en', 'GB', 'construction',  true),
  ('Construction Physics',       'https://www.construction-physics.com/feed',          'rss', 'en', 'US', 'analysis',      true),
  ('Construction Management (CIOB)', 'https://constructionmanagement.co.uk/feed/',     'rss', 'en', 'GB', 'construction',  true),
  ('ArchDaily',                  'https://www.archdaily.com/rss/',                     'rss', 'en', 'US', 'architecture',  true),
  -- Mô tả tốt, cào content từ link gốc
  ('Smart Cities Dive',          'https://www.smartcitiesdive.com/feeds/news/',        'rss', 'en', 'US', 'smart_city',    true),
  ('Construction Week Online',   'https://www.constructionweekonline.com/feed',        'rss', 'en', 'AE', 'construction',  true)
ON CONFLICT (url) DO UPDATE
  SET is_active = true, type = 'rss', updated_at = now();

-- 3) Đảm bảo các nguồn RSS trực tiếp seed sẵn vẫn active
UPDATE tech_sources SET is_active = true, updated_at = now()
WHERE url IN (
  'https://www.constructiondive.com/feeds/news/',
  'https://blogs.autodesk.com/feed/',
  'https://www.buildingsmart.org/feed/',
  'https://canada.constructconnect.com/dcn/feed'
);
