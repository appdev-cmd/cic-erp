import { Customer } from './customer';
import { CustomerContact } from './customer';
import { Employee } from './employee';
import { Product } from './product';
import { UserProfile } from './workflow';

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
  stage_id?: string;
  expected_value?: number;
  assigned_to?: string;
  unit_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  products?: any[]; // JSONB danh sách sản phẩm
  
  // Joined relations
  stage?: CrmStageTemplate;
  customer?: Customer;
  assignee?: Employee;
  creator?: Employee;
  activities?: CrmActivity[];
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
  
  // Joined relations
  customer?: Customer;
  contact?: CustomerContact;
  stage?: CrmStageTemplate;
  assignee?: Employee;
  creator?: Employee;
  products?: CrmDealProduct[];
  activities?: CrmActivity[];
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
