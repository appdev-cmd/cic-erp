import { dataClient as supabase } from '../lib/dataClient';
import { CrmLead, CrmDeal, CrmStageTemplate, CrmActivity, CrmDealProduct } from '../types';

// ============================================
// STAGE TEMPLATES SERVICE
// ============================================
export const CrmStageTemplateService = {
  getAll: async (entityType: 'lead' | 'deal'): Promise<CrmStageTemplate[]> => {
    const { data, error } = await supabase
      .from('crm_stage_templates')
      .select('*')
      .eq('entity_type', entityType)
      .order('sort_order');
    if (error) throw error;
    return data;
  }
};

// ============================================
// LEADS SERVICE
// ============================================
export const CrmLeadService = {
  getAll: async (unitId?: string): Promise<CrmLead[]> => {
    let query = supabase
      .from('crm_leads')
      .select('*, stage:crm_stage_templates(*), assignee:profiles!crm_leads_assigned_to_fkey(*)');
      
    if (unitId) {
      query = query.eq('unit_id', unitId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  
  getById: async (id: string): Promise<CrmLead> => {
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*, stage:crm_stage_templates(*), assignee:profiles!crm_leads_assigned_to_fkey(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  create: async (lead: Partial<CrmLead>): Promise<CrmLead> => {
    const { data, error } = await supabase
      .from('crm_leads')
      .insert(lead)
      .select('*, stage:crm_stage_templates(*)')
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, lead: Partial<CrmLead>): Promise<CrmLead> => {
    const { data, error } = await supabase
      .from('crm_leads')
      .update(lead)
      .eq('id', id)
      .select('*, stage:crm_stage_templates(*)')
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('crm_leads').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// DEALS SERVICE
// ============================================
export const CrmDealService = {
  getAll: async (unitId?: string): Promise<CrmDeal[]> => {
    let query = supabase
      .from('crm_deals')
      .select('*, stage:crm_stage_templates(*), assignee:profiles!crm_deals_assigned_to_fkey(*), customer:customers(*), contact:customer_contacts(*)');
      
    if (unitId) {
      query = query.eq('unit_id', unitId);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getById: async (id: string): Promise<CrmDeal> => {
    const { data, error } = await supabase
      .from('crm_deals')
      .select('*, stage:crm_stage_templates(*), assignee:profiles!crm_deals_assigned_to_fkey(*), customer:customers(*), contact:customer_contacts(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  create: async (deal: Partial<CrmDeal>): Promise<CrmDeal> => {
    const { data, error } = await supabase
      .from('crm_deals')
      .insert(deal)
      .select('*, stage:crm_stage_templates(*)')
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, deal: Partial<CrmDeal>): Promise<CrmDeal> => {
    const { data, error } = await supabase
      .from('crm_deals')
      .update(deal)
      .eq('id', id)
      .select('*, stage:crm_stage_templates(*)')
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('crm_deals').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// ACTIVITIES SERVICE
// ============================================
export const CrmActivityService = {
  getByEntity: async (entityType: 'lead' | 'deal', entityId: string): Promise<CrmActivity[]> => {
    const column = entityType === 'lead' ? 'lead_id' : 'deal_id';
    const { data, error } = await supabase
      .from('crm_activities')
      .select('*, creator:profiles(*)')
      .eq(column, entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  create: async (activity: Partial<CrmActivity>): Promise<CrmActivity> => {
    // Demo logic: simulate AI scoring if activity is chat/note/call
    let ai_score: number | undefined = undefined;
    let ai_feedback: string | undefined = undefined;
    
    if (activity.description && activity.description.length > 50) {
      ai_score = Math.floor(Math.random() * 20) + 80; // 80-100
      ai_feedback = "Ghi chú chi tiết, tốt!";
    } else if (activity.description && activity.description.length > 0) {
      ai_score = Math.floor(Math.random() * 30) + 40; // 40-70
      ai_feedback = "Nội dung hơi ngắn, cần ghi rõ tình trạng và nhu cầu của khách hàng hơn.";
    }

    const { data, error } = await supabase
      .from('crm_activities')
      .insert({
        ...activity,
        ai_score: activity.ai_score || ai_score,
        ai_feedback: activity.ai_feedback || ai_feedback
      })
      .select('*, creator:profiles(*)')
      .single();
      
    if (error) throw error;
    return data;
  }
};
