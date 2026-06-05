import { Customer } from './customer';
import { CustomerContact } from './customer';
import { Employee } from './employee';
import { Product } from './product';
import { UserProfile } from './workflow';

// ============================================
// SOURCE ENUM & LABELS
// ============================================
export type LeadSource = 'website' | 'email' | 'phone' | 'referral' | 'social' | 'event' | 'import' | 'api' | 'other';

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Website',
  email: 'Email',
  phone: 'Điện thoại',
  referral: 'Giới thiệu',
  social: 'Mạng xã hội',
  event: 'Sự kiện',
  import: 'Import Excel',
  api: 'API',
  other: 'Khác',
};

export const SOURCE_DETAIL_PLACEHOLDER: Record<LeadSource, string> = {
  website: 'VD: Trang sản phẩm Revit, Landing page BIM360...',
  email: 'VD: Email marketing Q2, Newsletter tháng 6...',
  phone: 'VD: Hotline, tổng đài 1900...',
  referral: 'VD: Nguyễn Văn A giới thiệu, Đối tác XYZ...',
  social: 'VD: Fanpage Facebook, Group Zalo BIM, Telegram...',
  event: 'VD: Hội thảo BIM 2026, Triển lãm Vietbuild...',
  import: 'VD: File danh sách khách hàng tiềm năng Q2...',
  api: 'VD: Website form, Chatbot, Zalo OA webhook...',
  other: 'Ghi chú nguồn lead...',
};

export const LEAD_SOURCE_ICONS: Record<LeadSource, string> = {
  website: 'Globe',
  email: 'Mail',
  phone: 'Phone',
  referral: 'Users',
  social: 'MessageCircle',
  event: 'Calendar',
  import: 'FileSpreadsheet',
  api: 'Webhook',
  other: 'MoreHorizontal',
};

// ============================================
// REGION
// ============================================
export type RegionType = 'north' | 'central' | 'south' | 'unknown';

export const REGION_LABELS: Record<RegionType, string> = {
  north: 'Miền Bắc',
  central: 'Miền Trung',
  south: 'Miền Nam',
  unknown: 'Chưa xác định',
};

// ============================================
// POTENTIAL LEVEL (đánh giá trong stage "Đang xử lý")
// ============================================
export type PotentialLevel = 'very_low' | 'low' | 'medium' | 'high' | 'none';

export const POTENTIAL_LEVEL_LABELS: Record<PotentialLevel, string> = {
  very_low: 'Tiềm năng rất thấp',
  low: 'Tiềm năng thấp',
  medium: 'Tiềm năng trung bình',
  high: 'Tiềm năng cao',
  none: 'Không tiềm năng',
};

// Thứ tự để so sánh "nâng mức" (none = đóng, không xếp hạng cao thấp).
export const POTENTIAL_LEVEL_RANK: Record<PotentialLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  none: 0,
};

export const POTENTIAL_LEVEL_COLORS: Record<PotentialLevel, string> = {
  very_low: '#94A3B8', // slate-400
  low: '#60A5FA',      // blue-400
  medium: '#FBBF24',   // amber-400
  high: '#22C55E',     // green-500
  none: '#6B7280',     // gray-500
};

// ============================================
// DECISION ROLE
// ============================================
export type DecisionRole = 'decision_maker' | 'influencer' | 'user' | 'champion' | 'blocker' | 'unknown';

export const DECISION_ROLE_LABELS: Record<DecisionRole, string> = {
  decision_maker: 'Người quyết định',
  influencer: 'Người ảnh hưởng',
  user: 'Người sử dụng',
  champion: 'Người ủng hộ',
  blocker: 'Người phản đối',
  unknown: 'Chưa xác định',
};


export interface CrmStageTemplate {
  id: string;
  entity_type: 'lead' | 'deal';
  name: string;
  color: string;
  sort_order: number;
  is_win: boolean;
  is_lose: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmStage {
  id: string;
  template_id: string;
  unit_id: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  
  // Joined relation
  template?: CrmStageTemplate;
}

export interface CrmLead {
  id: string;
  title: string;
  name?: string;
  company_name?: string;
  customer_id?: string;
  phone?: string;
  email?: string;
  source?: string;
  source_detail?: string;
  region?: RegionType;
  stage_id?: string;
  expected_value?: number;
  // Đánh giá mức tiềm năng (phân loại trong stage "Đang xử lý")
  potential_level?: PotentialLevel;
  // Thông tin bắt buộc khi sang "Tiềm năng cao"
  address?: string;          // địa chỉ công ty
  contact_position?: string; // chức danh liên hệ chính
  assigned_to?: string;
  unit_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  products?: any[]; // JSONB danh sách sản phẩm
  
  // Completion fields (Bitrix24-style workflow)
  completion_result?: string; // 'deal+contact+company', 'deal+contact', 'deal', 'contact+company', 'contact', 'company', 'not_opportunity', 'lost', 'unqualified'
  completion_note?: string;
  is_opportunity?: boolean | null; // true = tạo Deal/Contact/Company, false = không phải cơ hội, null = chưa hoàn thành
  completed_at?: string;

  // Unit Pool model
  is_claimed?: boolean; // generated: assigned_to IS NOT NULL

  // AI Lead Intelligence
  intelligence_status?: 'none' | 'pending' | 'processing' | 'gathered' | 'completed' | 'failed';
  ai_score_contribution?: number; // 0-30, cộng vào điểm lead

  // Duplicate / Merge
  merged_into?: string | null; // id của lead giữ lại
  is_merged?: boolean;

  // Joined relations
  stage?: CrmStageTemplate;
  customer?: Customer;
  assignee?: Employee;
  creator?: Employee;
  activities?: CrmActivity[];
  intelligence?: CrmLeadIntelligence;
}

// ============================================
// AI LEAD INTELLIGENCE
// ============================================
export type IntelligenceStatus = 'pending' | 'processing' | 'gathered' | 'completed' | 'failed' | 'outdated';

export interface CrmRecommendedProduct {
  product_id: string;
  product_name: string;
  fit_score: number; // 0-100
  reasoning: string;
  talking_points: string[];
  urgency: 'high' | 'medium' | 'low';
}

export interface CrmSalesInsight {
  category: 'pain_point' | 'opportunity' | 'risk' | 'news' | 'contact_tip' | 'competitor';
  content: string;
  source_url?: string;
}

export interface CrmLeadIntelligence {
  id: string;
  lead_id: string;
  status: IntelligenceStatus;
  error_message?: string;
  gathered_sources?: Array<{ source: string; query: string; snippets: string[] }>;
  company_summary?: string;
  technology_level?: 'none' | 'basic' | 'intermediate' | 'advanced';
  industry_sector?: string;
  project_pipeline?: Array<{ name: string; type: string; scale: string; status: string }>;
  recommended_products?: CrmRecommendedProduct[];
  sales_insights?: CrmSalesInsight[];
  ai_score_contribution: number;
  ai_score_reasoning?: string;
  analyzed_at?: string;
  model_used?: string;
  triggered_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CrmDeal {
  id: string;
  title: string;
  customer_id?: string;
  contact_id?: string;
  amount: number;
  expected_revenue: number;
  currency: string;
  stage_id?: string;
  probability: number;
  expected_close_date?: string;
  source?: string;
  assigned_to?: string;
  unit_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  
  // Extended CRM fields
  lead_id?: string;
  tags?: string[];
  lost_reason?: string;
  contract_id?: string;
  source_detail?: string;
  
  // Joined relations
  customer?: Customer;
  contact?: CustomerContact;
  stage?: CrmStageTemplate;
  assignee?: Employee;
  creator?: Employee;
  products?: CrmDealProduct[];
  activities?: CrmActivity[];
  lead?: CrmLead; // joined from crm_leads
}

export interface CrmActivity {
  id: string;
  lead_id?: string;
  deal_id?: string;
  activity_type: 'Zalo' | 'Telegram' | 'Note' | 'Call' | 'Email' | 'Meeting';
  description: string;
  ai_score?: number;
  ai_feedback?: string;
  created_by?: string;
  created_at: string;
  
  // Joined relations
  creator?: UserProfile;
}

export interface CrmDealProduct {
  id: string;
  deal_id: string;
  product_id: string;
  quantity: number;
  price: number;
  total: number;
  created_at: string;
  
  // Joined relations
  product?: Product;
}
