-- Khởi tạo schema cho Marketing Assistant Agent
-- Bảng quản lý kho bài viết và nội dung phễu Website
CREATE TABLE IF NOT EXISTS public.mkt_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_url TEXT,
  source_text TEXT,
  content_html TEXT,
  focus_keyword TEXT,
  meta_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewing', 'approved', 'published', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Bảng quản lý lịch đăng mạng xã hội đa kênh
CREATE TABLE IF NOT EXISTS public.mkt_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID REFERENCES public.mkt_pipeline(id) ON DELETE SET NULL,
  fb_content TEXT,
  fb_status TEXT NOT NULL DEFAULT 'pending' CHECK (fb_status IN ('pending', 'published', 'failed', 'skipped')),
  linkedin_content TEXT,
  linkedin_status TEXT NOT NULL DEFAULT 'pending' CHECK (linkedin_status IN ('pending', 'published', 'failed', 'skipped')),
  zalo_content TEXT,
  zalo_status TEXT NOT NULL DEFAULT 'pending' CHECK (zalo_status IN ('pending', 'published', 'failed', 'skipped')),
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Bảng quản lý chiến dịch Email Marketing / Bản tin (Newsletter)
CREATE TABLE IF NOT EXISTS public.mkt_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  html_template TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_for TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Bảng log gửi Email cho từng khách hàng
CREATE TABLE IF NOT EXISTS public.mkt_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.mkt_campaigns(id) ON DELETE CASCADE,
  contact_id UUID, -- Liên kết mềm tới crm_contacts. Có thể để null nếu contact bị xoá
  email_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Thiết lập Triggers cập nhật updated_at
CREATE TRIGGER update_mkt_pipeline_updated_at
  BEFORE UPDATE ON public.mkt_pipeline
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_mkt_social_posts_updated_at
  BEFORE UPDATE ON public.mkt_social_posts
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_mkt_campaigns_updated_at
  BEFORE UPDATE ON public.mkt_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Thiết lập Row Level Security (RLS)
ALTER TABLE public.mkt_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mkt_email_logs ENABLE ROW LEVEL SECURITY;

-- Policies cơ bản: Authenticated users có thể đọc và ghi các bảng Marketing
CREATE POLICY "Authenticated users can read mkt_pipeline." ON public.mkt_pipeline FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert mkt_pipeline." ON public.mkt_pipeline FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update mkt_pipeline." ON public.mkt_pipeline FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read mkt_social_posts." ON public.mkt_social_posts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert mkt_social_posts." ON public.mkt_social_posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update mkt_social_posts." ON public.mkt_social_posts FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read mkt_campaigns." ON public.mkt_campaigns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert mkt_campaigns." ON public.mkt_campaigns FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update mkt_campaigns." ON public.mkt_campaigns FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read mkt_email_logs." ON public.mkt_email_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert mkt_email_logs." ON public.mkt_email_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update mkt_email_logs." ON public.mkt_email_logs FOR UPDATE USING (auth.role() = 'authenticated');
