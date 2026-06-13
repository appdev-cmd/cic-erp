-- ============================================================================
-- ConTech Intelligence Hub — Database Schema
-- Smart Technology Monitoring & Analysis Center for AEC/ConTech
-- ============================================================================

-- 1. tech_sources: RSS feeds, Google News sources, web scrapers
CREATE TABLE IF NOT EXISTS tech_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'rss' CHECK (type IN ('rss','google_news','web','api','manual')),
  language TEXT DEFAULT 'en',
  country TEXT DEFAULT 'US',
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  crawl_frequency TEXT DEFAULT 'daily' CHECK (crawl_frequency IN ('hourly','daily','weekly')),
  last_crawled_at TIMESTAMPTZ,
  article_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. tech_articles: Crawled & analyzed news articles
CREATE TABLE IF NOT EXISTS tech_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_vi TEXT,
  url TEXT NOT NULL UNIQUE,
  source_id UUID REFERENCES tech_sources(id) ON DELETE SET NULL,
  summary TEXT,
  summary_vi TEXT,
  content TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  crawled_at TIMESTAMPTZ DEFAULT now(),
  language TEXT DEFAULT 'en',

  -- AI classification (multi-axis taxonomy)
  technologies TEXT[] DEFAULT '{}',
  technology_category TEXT,
  project_phases TEXT[] DEFAULT '{}',
  industries TEXT[] DEFAULT '{}',
  event_type TEXT,
  companies TEXT[] DEFAULT '{}',
  deployment_project TEXT,
  value_proposition TEXT,
  impact_level TEXT DEFAULT 'medium' CHECK (impact_level IN ('low','medium','high','breakthrough')),
  impact_reason TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','analyzing','analyzed','published','archived','spam')),
  view_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  ai_analysis JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. tech_reports: Weekly/Monthly/Quarterly digests
CREATE TABLE IF NOT EXISTS tech_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('weekly','monthly','quarterly','custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  content_markdown TEXT,
  content_html TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published')),
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by TEXT DEFAULT 'ai' CHECK (generated_by IN ('ai','manual')),
  article_count INTEGER DEFAULT 0,
  highlights JSONB DEFAULT '[]',
  statistics JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. tech_report_articles: Many-to-Many link report ↔ article
CREATE TABLE IF NOT EXISTS tech_report_articles (
  report_id UUID REFERENCES tech_reports(id) ON DELETE CASCADE,
  article_id UUID REFERENCES tech_articles(id) ON DELETE CASCADE,
  PRIMARY KEY (report_id, article_id)
);

-- 5. tech_bookmarks: Per-user article bookmarks
CREATE TABLE IF NOT EXISTS tech_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES tech_articles(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, article_id)
);

-- 6. tech_taxonomy: Expandable classification categories (admin-managed)
CREATE TABLE IF NOT EXISTS tech_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  label_vi TEXT NOT NULL,
  label_en TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('technology','phase','industry','event')),
  parent_id UUID REFERENCES tech_taxonomy(id),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code, "group")
);

-- ═══════════════════════════════════════════════════════
-- INDEXES for query performance
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tech_articles_status ON tech_articles(status);
CREATE INDEX IF NOT EXISTS idx_tech_articles_crawled ON tech_articles(crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_tech_articles_published ON tech_articles(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_tech_articles_impact ON tech_articles(impact_level);
CREATE INDEX IF NOT EXISTS idx_tech_articles_source ON tech_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_tech_articles_tech_category ON tech_articles(technology_category);
CREATE INDEX IF NOT EXISTS idx_tech_articles_event_type ON tech_articles(event_type);
CREATE INDEX IF NOT EXISTS idx_tech_articles_technologies ON tech_articles USING GIN(technologies);
CREATE INDEX IF NOT EXISTS idx_tech_articles_industries ON tech_articles USING GIN(industries);
CREATE INDEX IF NOT EXISTS idx_tech_articles_phases ON tech_articles USING GIN(project_phases);
CREATE INDEX IF NOT EXISTS idx_tech_articles_companies ON tech_articles USING GIN(companies);
CREATE INDEX IF NOT EXISTS idx_tech_articles_tags ON tech_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_tech_reports_type ON tech_reports(type, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_tech_reports_status ON tech_reports(status);
CREATE INDEX IF NOT EXISTS idx_tech_bookmarks_user ON tech_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_tech_taxonomy_group ON tech_taxonomy("group", sort_order);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════

ALTER TABLE tech_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_report_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_taxonomy ENABLE ROW LEVEL SECURITY;

-- Read: only authorized users (TGĐ, Chủ tịch, Marketing, Admin)
-- Implemented via a helper function for cleaner policies
CREATE OR REPLACE FUNCTION is_tech_intel_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('Admin', 'Leadership', 'Marketing')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Read policies — restricted to authorized roles
CREATE POLICY "tech_sources_read" ON tech_sources FOR SELECT TO authenticated
  USING (is_tech_intel_user());

CREATE POLICY "tech_articles_read" ON tech_articles FOR SELECT TO authenticated
  USING (is_tech_intel_user());

CREATE POLICY "tech_reports_read" ON tech_reports FOR SELECT TO authenticated
  USING (is_tech_intel_user());

CREATE POLICY "tech_report_articles_read" ON tech_report_articles FOR SELECT TO authenticated
  USING (is_tech_intel_user());

CREATE POLICY "tech_taxonomy_read" ON tech_taxonomy FOR SELECT TO authenticated
  USING (is_tech_intel_user());

-- Write policies — Admin only for management operations
CREATE POLICY "tech_sources_write" ON tech_sources FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin','Leadership')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin','Leadership')));

CREATE POLICY "tech_articles_insert" ON tech_articles FOR INSERT TO authenticated
  WITH CHECK (is_tech_intel_user());

CREATE POLICY "tech_articles_update" ON tech_articles FOR UPDATE TO authenticated
  USING (is_tech_intel_user())
  WITH CHECK (is_tech_intel_user());

CREATE POLICY "tech_reports_write" ON tech_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin','Leadership')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin','Leadership')));

CREATE POLICY "tech_report_articles_write" ON tech_report_articles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin','Leadership')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin','Leadership')));

CREATE POLICY "tech_taxonomy_write" ON tech_taxonomy FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin','Leadership')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin','Leadership')));

-- Bookmarks: user owns their own bookmarks
CREATE POLICY "tech_bookmarks_select" ON tech_bookmarks FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "tech_bookmarks_insert" ON tech_bookmarks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tech_bookmarks_delete" ON tech_bookmarks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════
-- SEED DEFAULT TAXONOMY (6+8+9+12 items)
-- ═══════════════════════════════════════════════════════

-- Technology Categories (Nhóm A)
INSERT INTO tech_taxonomy (code, label_vi, label_en, "group", sort_order, keywords) VALUES
  ('software_platform', 'Phần mềm & Nền tảng số', 'Software & Digital Platforms', 'technology', 1, ARRAY['BIM','CDE','Digital Twin','IoT','GIS','SCADA','Asset Management','Smart City','Smart Factory']),
  ('ai_solution', 'Giải pháp AI', 'AI Solutions', 'technology', 2, ARRAY['AI','Machine Learning','Deep Learning','Computer Vision','NLP','GPT','LLM','Neural Network']),
  ('robotics_automation', 'Robot & Tự động hóa', 'Robotics & Automation', 'technology', 3, ARRAY['Robot','Drone','UAV','Autonomous','3D Printing','Additive Manufacturing','Automation']),
  ('consulting', 'Dịch vụ tư vấn', 'Consulting Services', 'technology', 4, ARRAY['Consulting','Advisory','Strategy','Implementation','Integration','Training']),
  ('green_certification', 'Chứng chỉ & Tiêu chuẩn xanh', 'Green Certifications & Standards', 'technology', 5, ARRAY['LEED','BREEAM','Green Mark','WELL','EDGE','Net Zero','Carbon Neutral','ESG']),
  ('energy_emission', 'Tiết kiệm NL & Giảm phát thải', 'Energy Saving & Emission Reduction', 'technology', 6, ARRAY['Energy','Solar','Wind','Battery','Microgrid','Carbon','Emission','Renewable','Heat Recovery'])
ON CONFLICT (code, "group") DO NOTHING;

-- Project Phases (Nhóm B)
INSERT INTO tech_taxonomy (code, label_vi, label_en, "group", sort_order, keywords) VALUES
  ('survey', 'Khảo sát & Thu thập', 'Survey & Data Collection', 'phase', 1, ARRAY['Survey','Scanning','Drone Survey','Reality Capture','GIS','Laser','Lidar']),
  ('design', 'Thiết kế', 'Design', 'phase', 2, ARRAY['Design','Architecture','Structural','MEP','Generative Design','BIM Modeling']),
  ('planning', 'Lập kế hoạch', 'Planning & Preparation', 'phase', 3, ARRAY['Estimation','Scheduling','Risk','Tender','Planning','Budget']),
  ('construction', 'Thi công', 'Construction', 'phase', 4, ARRAY['Construction','Building','Site','Safety','Quality Control','Material','Progress']),
  ('project_management', 'Quản lý dự án', 'Project Management', 'phase', 5, ARRAY['Project Management','PMO','Cost','Schedule','Document','Change','Risk Management']),
  ('handover', 'Hoàn công & Bàn giao', 'Handover & Commissioning', 'phase', 6, ARRAY['Handover','Commissioning','As-built','Asset Information Model','Digital Handover']),
  ('operations', 'Vận hành & Bảo trì', 'Operations & Maintenance', 'phase', 7, ARRAY['Facility Management','Asset Management','Maintenance','Predictive','Condition Monitoring']),
  ('monitoring', 'Giám sát vận hành', 'Operational Monitoring', 'phase', 8, ARRAY['Structural Health','Vibration','Settlement','Crack','Environmental','Noise','Dust','Energy Monitoring','Carbon Monitoring'])
ON CONFLICT (code, "group") DO NOTHING;

-- Industry Sectors (Nhóm C)
INSERT INTO tech_taxonomy (code, label_vi, label_en, "group", sort_order, keywords) VALUES
  ('civil', 'Xây dựng dân dụng', 'Civil Construction', 'industry', 1, ARRAY['Residential','Office','Hotel','Hospital','School','Apartment','Commercial']),
  ('industrial', 'Xây dựng công nghiệp', 'Industrial Construction', 'industry', 2, ARRAY['Factory','Industrial Park','Warehouse','Logistics','Manufacturing Plant']),
  ('infrastructure', 'Hạ tầng', 'Infrastructure', 'industry', 3, ARRAY['Road','Bridge','Tunnel','Railway','Metro','Airport','Port','Highway']),
  ('energy', 'Năng lượng', 'Energy', 'industry', 4, ARRAY['Solar','Wind','Hydro','Coal','Gas','Hydrogen','Nuclear','Renewable']),
  ('oil_gas', 'Dầu khí', 'Oil & Gas', 'industry', 5, ARRAY['Oil','Gas','Petroleum','Refinery','Pipeline','Offshore','Upstream','Downstream']),
  ('power', 'Điện lực', 'Power', 'industry', 6, ARRAY['Transmission','Distribution','Substation','Smart Grid','Power Plant']),
  ('mining', 'Khai khoáng', 'Mining', 'industry', 7, ARRAY['Mining','Coal Mining','Metal','Mineral','Quarry']),
  ('materials', 'Vật liệu xây dựng', 'Construction Materials', 'industry', 8, ARRAY['Cement','Steel','Glass','Aluminum','Brick','Concrete','Timber']),
  ('manufacturing', 'Sản xuất công nghiệp', 'Industrial Manufacturing', 'industry', 9, ARRAY['Automotive','Electronics','Mechanical','Fabrication','Assembly'])
ON CONFLICT (code, "group") DO NOTHING;

-- Event Types (Nhóm D)
INSERT INTO tech_taxonomy (code, label_vi, label_en, "group", sort_order, keywords) VALUES
  ('product_launch', 'Ra mắt sản phẩm', 'Product Launch', 'event', 1, ARRAY['Launch','Release','Announce','Unveil','Introduce']),
  ('new_solution', 'Giải pháp mới', 'New Solution', 'event', 2, ARRAY['Solution','Platform','Service','Tool','Feature']),
  ('project_announcement', 'Dự án mới', 'Project Announcement', 'event', 3, ARRAY['Project','Contract','Award','Deploy','Implement']),
  ('new_customer', 'Khách hàng mới', 'New Customer', 'event', 4, ARRAY['Customer','Client','Partner','User','Adopt']),
  ('partnership', 'Đối tác mới', 'Partnership', 'event', 5, ARRAY['Partnership','Collaboration','Alliance','Joint Venture','Agreement']),
  ('case_study', 'Case Study', 'Case Study', 'event', 6, ARRAY['Case Study','Success Story','Use Case','Application','Results']),
  ('conference', 'Hội nghị / Triển lãm', 'Conference / Exhibition', 'event', 7, ARRAY['Conference','Exhibition','Summit','Forum','Show','Expo']),
  ('webinar', 'Webinar', 'Webinar', 'event', 8, ARRAY['Webinar','Workshop','Seminar','Training','Demo']),
  ('white_paper', 'White Paper', 'White Paper / Research', 'event', 9, ARRAY['White Paper','Research','Report','Study','Survey','Analysis']),
  ('review', 'Đánh giá', 'Review', 'event', 10, ARRAY['Review','Evaluation','Assessment','Benchmark','Comparison']),
  ('pilot_project', 'Pilot Project', 'Pilot Project', 'event', 11, ARRAY['Pilot','Trial','Test','Prototype','PoC','Proof of Concept']),
  ('large_deployment', 'Triển khai lớn', 'Large Deployment', 'event', 12, ARRAY['Scale','Enterprise','Nationwide','Large-scale','Full Deployment'])
ON CONFLICT (code, "group") DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- SEED DEFAULT RSS SOURCES (Multi-country)
-- ═══════════════════════════════════════════════════════

INSERT INTO tech_sources (name, url, type, language, country, category) VALUES
  -- US Sources
  ('Construction Dive', 'https://www.constructiondive.com/feeds/news/', 'rss', 'en', 'US', 'construction'),
  ('ENR - Engineering News-Record', 'https://news.google.com/rss/search?q=site:enr.com&hl=en-US&gl=US&ceid=US:en', 'google_news', 'en', 'US', 'engineering'),
  ('Autodesk Blog', 'https://blogs.autodesk.com/feed/', 'rss', 'en', 'US', 'bim_software'),
  ('Bentley Systems Blog', 'https://news.google.com/rss/search?q=site:bentley.com&hl=en-US&gl=US&ceid=US:en', 'google_news', 'en', 'US', 'infrastructure'),
  ('BuildingSMART News', 'https://www.buildingsmart.org/feed/', 'rss', 'en', 'US', 'bim_standard'),
  
  -- UK Sources
  ('Construction News UK', 'https://news.google.com/rss/search?q=site:constructionnews.co.uk&hl=en-GB&gl=GB&ceid=GB:en', 'google_news', 'en', 'GB', 'construction'),
  ('BIM+', 'https://news.google.com/rss/search?q=site:bimplus.co.uk&hl=en-GB&gl=GB&ceid=GB:en', 'google_news', 'en', 'GB', 'bim'),
  
  -- Canada
  ('Daily Commercial News', 'https://canada.constructconnect.com/dcn/feed', 'rss', 'en', 'CA', 'construction'),
  
  -- Singapore
  ('BCA Singapore News', 'https://news.google.com/rss/search?q=site:www1.bca.gov.sg&hl=en-SG&gl=SG&ceid=SG:en', 'google_news', 'en', 'SG', 'building'),
  
  -- Google News RSS (multi-language)
  ('Google News: ConTech EN', 'https://news.google.com/rss/search?q=construction+technology&hl=en-US&gl=US&ceid=US:en', 'google_news', 'en', 'US', 'contech'),
  ('Google News: BIM', 'https://news.google.com/rss/search?q=BIM+building+information+modeling&hl=en-US&gl=US&ceid=US:en', 'google_news', 'en', 'US', 'bim'),
  ('Google News: Construction Robot', 'https://news.google.com/rss/search?q=construction+robot+automation&hl=en-US&gl=US&ceid=US:en', 'google_news', 'en', 'US', 'robotics'),
  ('Google News: Digital Twin Construction', 'https://news.google.com/rss/search?q=digital+twin+construction+infrastructure&hl=en-US&gl=US&ceid=US:en', 'google_news', 'en', 'US', 'digital_twin'),
  ('Google News: Green Building', 'https://news.google.com/rss/search?q=green+building+sustainability+construction&hl=en-US&gl=US&ceid=US:en', 'google_news', 'en', 'US', 'green'),
  ('Google News: 建設テクノロジー', 'https://news.google.com/rss/search?q=建設+テクノロジー+BIM+DX&hl=ja&gl=JP&ceid=JP:ja', 'google_news', 'ja', 'JP', 'contech'),
  ('Google News: 건설기술', 'https://news.google.com/rss/search?q=건설+기술+BIM+스마트건설&hl=ko&gl=KR&ceid=KR:ko', 'google_news', 'ko', 'KR', 'contech'),
  ('Google News: 建筑科技', 'https://news.google.com/rss/search?q=建筑科技+BIM+智慧建造&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', 'google_news', 'zh', 'CN', 'contech'),
  ('Google News: Bautechnologie', 'https://news.google.com/rss/search?q=Bautechnologie+BIM+Digitalisierung+Bauwesen&hl=de&gl=DE&ceid=DE:de', 'google_news', 'de', 'DE', 'contech'),
  ('Google News: Construction Tech FR', 'https://news.google.com/rss/search?q=technologie+construction+BIM+innovation&hl=fr&gl=FR&ceid=FR:fr', 'google_news', 'fr', 'FR', 'contech'),
  ('Google News: Construction IL', 'https://news.google.com/rss/search?q=construction+technology+startup+Israel&hl=en&gl=IL&ceid=IL:en', 'google_news', 'en', 'IL', 'contech'),
  ('Google News: Construction India', 'https://news.google.com/rss/search?q=construction+technology+India+smart+city&hl=en-IN&gl=IN&ceid=IN:en', 'google_news', 'en', 'IN', 'contech'),
  ('Google News: Công nghệ Xây dựng VN', 'https://news.google.com/rss/search?q=công+nghệ+xây+dựng+BIM+Việt+Nam&hl=vi&gl=VN&ceid=VN:vi', 'google_news', 'vi', 'VN', 'contech')
ON CONFLICT (url) DO NOTHING;
