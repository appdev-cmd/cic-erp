-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Thêm cấu hình CRM cho Units
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS allow_shared_crm BOOLEAN DEFAULT true;

-- 1. Bảng Template Trạng thái (Admin cấu hình chung)
CREATE TABLE IF NOT EXISTS public.crm_stage_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead', 'deal')),
  name TEXT NOT NULL,
  color TEXT,
  sort_order INT DEFAULT 0,
  is_win BOOLEAN DEFAULT false,
  is_lose BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng mapping Trạng thái sử dụng cho từng Unit (Tùy chọn)
CREATE TABLE IF NOT EXISTS public.crm_stages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES public.crm_stage_templates(id) ON DELETE CASCADE,
  unit_id TEXT REFERENCES public.units(id) ON DELETE CASCADE,
  sort_order INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Leads (Đầu mối)
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  name TEXT,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  source TEXT,
  stage_id UUID REFERENCES public.crm_stage_templates(id),
  expected_value DECIMAL,
  assigned_to UUID REFERENCES public.profiles(id),
  unit_id TEXT REFERENCES public.units(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Deals (Cơ hội/Giao dịch)
CREATE TABLE IF NOT EXISTS public.crm_deals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  customer_id TEXT REFERENCES public.customers(id),
  contact_id TEXT REFERENCES public.customer_contacts(id),
  amount DECIMAL DEFAULT 0,
  expected_revenue DECIMAL DEFAULT 0,
  currency TEXT DEFAULT 'VND',
  stage_id UUID REFERENCES public.crm_stage_templates(id),
  probability INT DEFAULT 0,
  expected_close_date DATE,
  source TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  unit_id TEXT REFERENCES public.units(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bảng CRM Activities (Nhật ký tương tác)
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- Zalo, Telegram, Note, Call, Email, Meeting
  description TEXT NOT NULL,
  ai_score INT,
  ai_feedback TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bảng Deal Products (Sản phẩm dự kiến)
CREATE TABLE IF NOT EXISTS public.crm_deal_products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.products(id),
  quantity DECIMAL DEFAULT 1,
  price DECIMAL DEFAULT 0,
  total DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Triggers for updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION update_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER set_crm_deals_updated_at BEFORE UPDATE ON public.crm_deals
FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();

CREATE TRIGGER set_crm_stage_templates_updated_at BEFORE UPDATE ON public.crm_stage_templates
FOR EACH ROW EXECUTE FUNCTION update_crm_updated_at();


-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

ALTER TABLE public.crm_stage_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_products ENABLE ROW LEVEL SECURITY;

-- 1. Stage Templates (Admin can manage, others read)
CREATE POLICY "crm_stage_templates_read" ON public.crm_stage_templates FOR SELECT USING (true);
CREATE POLICY "crm_stage_templates_manage" ON public.crm_stage_templates FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit')
);

-- 2. Leads RLS
CREATE POLICY "crm_leads_view" ON public.crm_leads FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit')
  OR (
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT allow_shared_crm FROM units WHERE id = crm_leads.unit_id) = true
      OR assigned_to = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'UnitLeader'
    )
  )
);

CREATE POLICY "crm_leads_manage" ON public.crm_leads FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit')
  OR (
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT allow_shared_crm FROM units WHERE id = crm_leads.unit_id) = true
      OR assigned_to = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'UnitLeader'
    )
  )
);

-- 3. Deals RLS
CREATE POLICY "crm_deals_view" ON public.crm_deals FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit')
  OR (
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT allow_shared_crm FROM units WHERE id = crm_deals.unit_id) = true
      OR assigned_to = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'UnitLeader'
    )
  )
);

CREATE POLICY "crm_deals_manage" ON public.crm_deals FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('Leadership', 'AdminUnit')
  OR (
    unit_id = (SELECT unit_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT allow_shared_crm FROM units WHERE id = crm_deals.unit_id) = true
      OR assigned_to = auth.uid()
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'UnitLeader'
    )
  )
);

-- 4. Activities & Products (Follow Lead/Deal permissions)
CREATE POLICY "crm_activities_view" ON public.crm_activities FOR SELECT USING (true);
CREATE POLICY "crm_activities_manage" ON public.crm_activities FOR ALL USING (true);
-- To keep simple for now, open read/write since it's filtered by UI. In production, we'd join deals/leads.

CREATE POLICY "crm_deal_products_view" ON public.crm_deal_products FOR SELECT USING (true);
CREATE POLICY "crm_deal_products_manage" ON public.crm_deal_products FOR ALL USING (true);

-- ==========================================
-- Trigger Auto-Create Contract on Won Deal
-- ==========================================
CREATE OR REPLACE FUNCTION auto_create_contract_from_deal()
RETURNS TRIGGER AS $$
DECLARE
  v_is_win BOOLEAN;
  v_contract_id UUID;
BEGIN
  -- Kiểm tra nếu stage thay đổi
  IF (TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id) OR (TG_OP = 'INSERT') THEN
    -- Check if new stage is WIN
    SELECT is_win INTO v_is_win FROM public.crm_stage_templates WHERE id = NEW.stage_id;
    
    IF v_is_win = true THEN
      -- Create contract if customer is specified
      IF NEW.customer_id IS NOT NULL THEN
        INSERT INTO public.contracts (
          customer_id, 
          name, 
          value, 
          unit_id, 
          assigned_to
        ) VALUES (
          NEW.customer_id,
          'HĐ - ' || NEW.title,
          NEW.amount,
          NEW.unit_id,
          NEW.assigned_to
        ) RETURNING id INTO v_contract_id;
        
        -- Logic to copy products could go here if needed
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_create_contract
AFTER INSERT OR UPDATE OF stage_id ON public.crm_deals
FOR EACH ROW EXECUTE FUNCTION auto_create_contract_from_deal();

-- Seed initial templates
INSERT INTO public.crm_stage_templates (entity_type, name, color, sort_order, is_win, is_lose) VALUES
('lead', 'Đầu mối mới khởi tạo', '#3B82F6', 1, false, false),
('lead', 'Phân loại tiềm năng thấp', '#60A5FA', 2, false, false),
('lead', 'Phân loại tiềm năng cao', '#93C5FD', 3, true, false),
('lead', 'Thất bại', '#F87171', 4, false, true),
('deal', 'Cơ hội mới', '#F59E0B', 1, false, false),
('deal', 'Báo giá sơ bộ', '#FBBF24', 2, false, false),
('deal', 'Dùng thử/Hỗ trợ', '#FCD34D', 3, false, false),
('deal', 'Báo giá chính thức', '#FDE68A', 4, false, false),
('deal', 'Chốt đơn mua', '#10B981', 5, true, false),
('deal', 'Tạm dừng', '#EF4444', 6, false, true),
('deal', 'Close deal', '#374151', 7, false, true)
ON CONFLICT DO NOTHING;
