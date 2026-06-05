import { dataClient as supabase } from '../lib/dataClient';
import { CrmLead, CrmDeal, CrmStageTemplate, CrmActivity, CrmDealProduct } from '../types';
import { AuditLogService } from './auditLogService';

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
      .select('*, stage:crm_stage_templates(*), assignee:profiles!crm_leads_assigned_to_fkey(id, name:full_name, avatar:avatar_url, email, role)');

    if (unitId) {
      query = query.eq('unit_id', unitId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    // Ẩn lead đã gộp (lọc client-side để không phụ thuộc cột is_merged khi chưa migrate)
    return (data || []).filter((l: CrmLead) => !l.is_merged);
  },
  
  getById: async (id: string): Promise<CrmLead> => {
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*, stage:crm_stage_templates(*), assignee:profiles!crm_leads_assigned_to_fkey(id, name:full_name, avatar:avatar_url, email, role)')
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

    // Audit log
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await AuditLogService.create({
        user_id: user?.id || null,
        table_name: 'crm_leads',
        record_id: data.id,
        action: 'INSERT',
        old_data: null,
        new_data: data,
        comment: null,
      });
    } catch (e) {
      console.warn('[CrmLeadService] Audit log failed:', e);
    }

    return data;
  },

  update: async (id: string, lead: Partial<CrmLead>): Promise<CrmLead> => {
    // Lấy old data trước khi update
    let oldData: any = null;
    try {
      const { data: old } = await supabase.from('crm_leads').select('*').eq('id', id).single();
      oldData = old;
    } catch (_) { /* ignore */ }

    const { data, error } = await supabase
      .from('crm_leads')
      .update(lead)
      .eq('id', id)
      .select('*, stage:crm_stage_templates(*)')
      .single();
    if (error) throw error;

    // Audit log
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await AuditLogService.create({
        user_id: user?.id || null,
        table_name: 'crm_leads',
        record_id: id,
        action: 'UPDATE',
        old_data: oldData,
        new_data: data,
        comment: null,
      });
    } catch (e) {
      console.warn('[CrmLeadService] Audit log failed:', e);
    }

    return data;
  },

  delete: async (id: string): Promise<void> => {
    // Lấy old data trước khi xóa
    let oldData: any = null;
    try {
      const { data: old } = await supabase.from('crm_leads').select('*').eq('id', id).single();
      oldData = old;
    } catch (_) { /* ignore */ }

    const { error } = await supabase.from('crm_leads').delete().eq('id', id);
    if (error) throw error;

    // Audit log
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await AuditLogService.create({
        user_id: user?.id || null,
        table_name: 'crm_leads',
        record_id: id,
        action: 'DELETE',
        old_data: oldData,
        new_data: null,
        comment: null,
      });
    } catch (e) {
      console.warn('[CrmLeadService] Audit log failed:', e);
    }
  },

  // Kiểm tra trùng lặp theo phone/email
  checkDuplicates: async (phone?: string, email?: string): Promise<CrmLead[]> => {
    const results: CrmLead[] = [];
    if (phone) {
      const { data } = await supabase.from('crm_leads')
        .select('id, title, phone, email, company_name, stage:crm_stage_templates(name)')
        .eq('phone', phone).limit(3);
      if (data) results.push(...data as any[]);
    }
    if (email) {
      const { data } = await supabase.from('crm_leads')
        .select('id, title, phone, email, company_name, stage:crm_stage_templates(name)')
        .eq('email', email).limit(3);
      if (data) {
        // Deduplicate
        for (const d of data as any[]) {
          if (!results.find(r => r.id === d.id)) results.push(d);
        }
      }
    }
    return results;
  },

  // Nhận lead (Unit Pool model)
  claimLead: async (leadId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Chưa đăng nhập');

    const { error } = await supabase.from('crm_leads')
      .update({ assigned_to: user.id })
      .eq('id', leadId)
      .is('assigned_to', null);

    if (error) throw new Error('Không thể nhận lead. Lead đã có người nhận.');

    // Audit log
    await AuditLogService.create({
      user_id: user.id,
      table_name: 'crm_leads',
      record_id: leadId,
      action: 'CLAIM',
      old_data: null,
      new_data: { assigned_to: user.id },
      comment: 'Nhận lead từ kho đơn vị',
    });
  },

  /**
   * Ao "Không tiềm năng" — lead ở stage is_lose của TOÀN CÔNG TY (không lọc unit)
   * để mọi người có thể khai thác lại. Sắp xếp theo completed_at tăng dần (cũ trước,
   * gần bị tự xoá 30 ngày hiển thị trên cùng).
   */
  getNoPotentialPool: async (): Promise<CrmLead[]> => {
    const { data: loseStages, error: stageErr } = await supabase
      .from('crm_stage_templates')
      .select('id')
      .eq('entity_type', 'lead')
      .eq('is_lose', true);
    if (stageErr) throw stageErr;
    const loseIds = (loseStages || []).map((s: any) => s.id);
    if (loseIds.length === 0) return [];

    const { data, error } = await supabase
      .from('crm_leads')
      .select('*, stage:crm_stage_templates(*), assignee:profiles!crm_leads_assigned_to_fkey(id, name:full_name, avatar:avatar_url, email, role)')
      .in('stage_id', loseIds)
      .order('completed_at', { ascending: true });
    if (error) throw error;
    return (data || []).filter((l: CrmLead) => !l.is_merged);
  },

  /**
   * "Nhận lại" lead từ ao Không tiềm năng: gán cho người nhận (kể cả lead khác unit /
   * đã có người trước đó) và kéo về unit của người nhận (nếu biết) để hiện trên board họ.
   */
  reclaimFromPool: async (leadId: string, unitId?: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Chưa đăng nhập');

    const patch: Record<string, any> = { assigned_to: user.id, updated_at: new Date().toISOString() };
    if (unitId) patch.unit_id = unitId;

    const { error } = await supabase.from('crm_leads').update(patch).eq('id', leadId);
    if (error) throw new Error('Không thể nhận lại lead: ' + error.message);

    await AuditLogService.create({
      user_id: user.id,
      table_name: 'crm_leads',
      record_id: leadId,
      action: 'CLAIM',
      old_data: null,
      new_data: patch,
      comment: 'Nhận lại lead từ ao Không tiềm năng',
    });
  },

  /**
   * Gộp lead `mergeId` vào lead `keepId`:
   * - Chuyển activities sang lead giữ lại
   * - Lấy giá trị ước tính cao hơn, điền các field còn thiếu
   * - Đánh dấu lead nguồn is_merged = true, merged_into = keepId
   */
  mergeLead: async (keepId: string, mergeId: string): Promise<void> => {
    if (keepId === mergeId) throw new Error('Không thể gộp lead vào chính nó');

    const [{ data: keep }, { data: merge }] = await Promise.all([
      supabase.from('crm_leads').select('*').eq('id', keepId).single(),
      supabase.from('crm_leads').select('*').eq('id', mergeId).single(),
    ]);
    if (!keep || !merge) throw new Error('Không tìm thấy lead để gộp');

    // Điền field còn thiếu từ lead nguồn + lấy giá trị cao hơn
    const merged: Partial<CrmLead> = {
      name: keep.name || merge.name,
      company_name: keep.company_name || merge.company_name,
      phone: keep.phone || merge.phone,
      email: keep.email || merge.email,
      source: keep.source || merge.source,
      source_detail: keep.source_detail || merge.source_detail,
      region: keep.region && keep.region !== 'unknown' ? keep.region : merge.region,
      customer_id: keep.customer_id || merge.customer_id,
      expected_value: Math.max(Number(keep.expected_value) || 0, Number(merge.expected_value) || 0),
      products: (Array.isArray(keep.products) && keep.products.length > 0) ? keep.products : merge.products,
    };

    // Chuyển activities sang lead giữ lại
    await supabase.from('crm_activities').update({ lead_id: keepId }).eq('lead_id', mergeId);

    // Cập nhật lead giữ lại
    const { error: keepErr } = await supabase.from('crm_leads').update(merged).eq('id', keepId);
    if (keepErr) throw keepErr;

    // Đánh dấu lead nguồn đã gộp
    const { error: mergeErr } = await supabase.from('crm_leads')
      .update({ is_merged: true, merged_into: keepId, updated_at: new Date().toISOString() })
      .eq('id', mergeId);
    if (mergeErr) throw mergeErr;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await AuditLogService.create({
        user_id: user?.id || null,
        table_name: 'crm_leads',
        record_id: keepId,
        action: 'MERGE',
        old_data: merge,
        new_data: { ...merged, merged_from: mergeId },
        comment: `Gộp lead "${merge.title}" vào "${keep.title}"`,
      });
    } catch (e) {
      console.warn('[CrmLeadService] Audit log (merge) failed:', e);
    }
  },
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

    // Audit log
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await AuditLogService.create({
        user_id: user?.id || null,
        table_name: 'crm_deals',
        record_id: data.id,
        action: 'INSERT',
        old_data: null,
        new_data: data,
        comment: null,
      });
    } catch (e) {
      console.warn('[CrmDealService] Audit log failed:', e);
    }

    return data;
  },

  update: async (id: string, deal: Partial<CrmDeal>): Promise<CrmDeal> => {
    // Lấy old data trước khi update
    let oldData: any = null;
    try {
      const { data: old } = await supabase.from('crm_deals').select('*').eq('id', id).single();
      oldData = old;
    } catch (_) { /* ignore */ }

    const { data, error } = await supabase
      .from('crm_deals')
      .update(deal)
      .eq('id', id)
      .select('*, stage:crm_stage_templates(*)')
      .single();
    if (error) throw error;

    // Audit log
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await AuditLogService.create({
        user_id: user?.id || null,
        table_name: 'crm_deals',
        record_id: id,
        action: 'UPDATE',
        old_data: oldData,
        new_data: data,
        comment: null,
      });
    } catch (e) {
      console.warn('[CrmDealService] Audit log failed:', e);
    }

    return data;
  },

  delete: async (id: string): Promise<void> => {
    // Lấy old data trước khi xóa
    let oldData: any = null;
    try {
      const { data: old } = await supabase.from('crm_deals').select('*').eq('id', id).single();
      oldData = old;
    } catch (_) { /* ignore */ }

    const { error } = await supabase.from('crm_deals').delete().eq('id', id);
    if (error) throw error;

    // Audit log
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await AuditLogService.create({
        user_id: user?.id || null,
        table_name: 'crm_deals',
        record_id: id,
        action: 'DELETE',
        old_data: oldData,
        new_data: null,
        comment: null,
      });
    } catch (e) {
      console.warn('[CrmDealService] Audit log failed:', e);
    }
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

// ============================================
// DEAL PRODUCTS SERVICE
// ============================================
export const CrmDealProductService = {
  getByDeal: async (dealId: string): Promise<CrmDealProduct[]> => {
    const { data, error } = await supabase
      .from('crm_deal_products')
      .select('*, product:products(*)')
      .eq('deal_id', dealId)
      .order('created_at');
    if (error) throw error;
    return data;
  },

  create: async (product: Partial<CrmDealProduct>): Promise<CrmDealProduct> => {
    const { data, error } = await supabase
      .from('crm_deal_products')
      .insert(product)
      .select('*, product:products(*)')
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('crm_deal_products').delete().eq('id', id);
    if (error) throw error;
  }
};

// ============================================
// COMPLETION SERVICE — Lead → (Bitrix24-style)
// ============================================

/** 7 combinations + 'not_opportunity' */
export type CompletionResultType =
  | 'deal+contact+company'
  | 'deal+contact'
  | 'deal+company'
  | 'deal'
  | 'contact+company'
  | 'contact'
  | 'company'
  | 'not_opportunity';

export interface CompleteLeadData {
  resultType: CompletionResultType;
  note: string;                     // Required note (assessment or rejection reason)
  
  // Company fields (required if resultType includes 'company')
  companyName?: string;
  companyTaxCode?: string;
  customerId?: string;              // Link existing company instead of creating new
  
  // Contact fields (required if resultType includes 'contact')
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactPosition?: string;
  
  // Deal fields (required if resultType includes 'deal')
  dealTitle?: string;
  dealAmount?: number;
  products?: Array<{ product_id: string; quantity: number; price: number }>;
  
  // Assignment
  unitId?: string;
  assignedTo?: string;
}

export interface CompleteLeadResult {
  dealId?: string;
  customerId?: string;
  contactId?: string;
  isOpportunity: boolean;
}

export const CrmCompletionService = {
  /**
   * Complete a Lead with Bitrix24-style result selection.
   * Creates entities based on resultType combination.
   */
  completeLead: async (
    leadId: string,
    data: CompleteLeadData
  ): Promise<CompleteLeadResult> => {
    const lead = await CrmLeadService.getById(leadId);
    if (!lead) throw new Error(`Lead not found: ${leadId}`);

    const isOpportunity = data.resultType !== 'not_opportunity';
    const shouldCreateCompany = isOpportunity && data.resultType.includes('company');
    const shouldCreateContact = isOpportunity && data.resultType.includes('contact');
    const shouldCreateDeal = isOpportunity && data.resultType.includes('deal');

    let customerId = data.customerId || undefined;
    let contactId: string | undefined;
    let dealId: string | undefined;

    // ── Step 1: Create or link Company ──
    if (shouldCreateCompany && !customerId) {
      const { data: newCustomer, error: customerErr } = await supabase
        .from('customers')
        .insert({
          name: data.companyName || lead.company_name || 'Chưa đặt tên',
          short_name: (data.companyName || lead.company_name || '').substring(0, 30),
          tax_code: data.companyTaxCode || null,
          type: 'Customer',
          phone: data.contactPhone || lead.phone || null,
          email: data.contactEmail || lead.email || null,
          source: lead.source || 'CRM Lead',
          rating: 'Standard',
        })
        .select('id')
        .single();

      if (customerErr) throw new Error(`Lỗi tạo công ty: ${customerErr.message}`);
      customerId = newCustomer.id;
    }

    // ── Step 2: Create Contact ──
    if (shouldCreateContact) {
      const { data: newContact, error: contactErr } = await supabase
        .from('customer_contacts')
        .insert({
          customer_id: customerId || null,
          name: data.contactName || lead.name || 'Chưa có tên',
          phone: data.contactPhone || lead.phone || null,
          email: data.contactEmail || lead.email || null,
          position: data.contactPosition || null,
          is_primary: true,
        })
        .select('id')
        .single();

      if (contactErr) {
        console.warn('[CrmCompletion] Failed to create contact:', contactErr.message);
      } else {
        contactId = newContact.id;
      }
    }

    // ── Step 3: Create Deal ──
    if (shouldCreateDeal) {
      // Find first deal stage
      const { data: firstDealStage } = await supabase
        .from('crm_stage_templates')
        .select('id')
        .eq('entity_type', 'deal')
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      const dealAmount = data.products
        ? data.products.reduce((sum, p) => sum + (p.quantity * p.price), 0)
        : (data.dealAmount || lead.expected_value || 0);

      const { data: newDeal, error: dealErr } = await supabase
        .from('crm_deals')
        .insert({
          title: data.dealTitle || lead.title || `Deal — ${data.companyName || lead.company_name || ''}`,
          customer_id: customerId || null,
          contact_id: contactId || null,
          amount: dealAmount,
          expected_revenue: dealAmount,
          currency: 'VND',
          stage_id: firstDealStage?.id || null,
          probability: 30,
          source: lead.source || null,
          assigned_to: data.assignedTo || lead.assigned_to || null,
          unit_id: data.unitId || lead.unit_id || null,
          created_by: lead.created_by || undefined,
        })
        .select('id')
        .single();

      if (dealErr) throw new Error(`Lỗi tạo deal: ${dealErr.message}`);
      dealId = newDeal.id;

      // Create DealProducts
      if (data.products && data.products.length > 0) {
        const dealProducts = data.products.map(p => ({
          deal_id: dealId!,
          product_id: p.product_id,
          quantity: p.quantity,
          price: p.price,
          total: p.quantity * p.price,
        }));

        const { error: prodErr } = await supabase
          .from('crm_deal_products')
          .insert(dealProducts);

        if (prodErr) {
          console.warn('[CrmCompletion] Failed to create deal products:', prodErr.message);
        }
      }
    }

    // ── Step 4: Mark lead as completed ──
    const completionUpdate: Record<string, any> = {
      completion_result: data.resultType,
      completion_note: data.note,
      is_opportunity: isOpportunity,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (customerId) completionUpdate.customer_id = customerId;

    const { error: leadErr } = await supabase
      .from('crm_leads')
      .update(completionUpdate)
      .eq('id', leadId);

    if (leadErr) {
      console.warn('[CrmCompletion] Failed to update lead:', leadErr.message);
    }

    // ── Step 5: Log Activity ──
    const activityDesc = isOpportunity
      ? `Hoàn thành Lead → ${data.resultType.replace(/\+/g, ' + ').toUpperCase()}\nGhi chú: ${data.note}`
      : `Đóng Lead — Không phải cơ hội.\nLý do: ${data.note}`;

    await CrmActivityService.create({
      lead_id: leadId,
      deal_id: dealId,
      activity_type: 'Note',
      description: activityDesc,
      created_by: lead.created_by || undefined,
    });

    return { dealId, customerId, contactId, isOpportunity };
  },
};

// ============================================
// UNIT ASSIGNMENT CONFIG SERVICE (Auto-routing)
// ============================================
export interface CrmUnitAssignmentConfig {
  id: string;
  unit_id: string;
  product_ids: string[];
  regions: string[];
  priority: number;
  is_default: boolean;
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  unit?: { id: string; name: string; code: string };
}

export interface CrmAssignmentBalanceStat {
  unit_id: string;
  unit_name: string;
  unit_code: string;
  leads_7d: number;
  leads_30d: number;
  balance_redirects_7d: number;
}

export const CrmAssignmentService = {
  getConfigs: async (): Promise<CrmUnitAssignmentConfig[]> => {
    const { data, error } = await supabase
      .from('crm_unit_assignment_config')
      .select('*, unit:units(id, name, code)')
      .order('priority', { ascending: false });
    if (error) throw error;
    return data as any;
  },

  createConfig: async (cfg: Partial<CrmUnitAssignmentConfig>): Promise<CrmUnitAssignmentConfig> => {
    const { data, error } = await supabase
      .from('crm_unit_assignment_config')
      .insert({
        unit_id: cfg.unit_id,
        product_ids: cfg.product_ids ?? [],
        regions: cfg.regions ?? ['north', 'central', 'south'],
        priority: cfg.priority ?? 0,
        is_default: cfg.is_default ?? false,
        is_active: cfg.is_active ?? true,
        notes: cfg.notes ?? null,
      })
      .select('*, unit:units(id, name, code)')
      .single();
    if (error) throw error;
    return data as any;
  },

  updateConfig: async (id: string, cfg: Partial<CrmUnitAssignmentConfig>): Promise<void> => {
    const { error } = await supabase
      .from('crm_unit_assignment_config')
      .update({ ...cfg, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  deleteConfig: async (id: string): Promise<void> => {
    const { error } = await supabase.from('crm_unit_assignment_config').delete().eq('id', id);
    if (error) throw error;
  },

  getBalanceStats: async (): Promise<CrmAssignmentBalanceStat[]> => {
    const { data, error } = await supabase.from('crm_assignment_balance_stats').select('*');
    if (error) throw error;
    return (data as any) || [];
  },

  // Phân công lại / chạy lại thuật toán routing cho 1 lead (gọi RPC)
  autoAssign: async (leadId: string): Promise<string | null> => {
    const { data, error } = await supabase.rpc('assign_lead_to_unit', { p_lead_id: leadId });
    if (error) throw error;
    return (data as string) ?? null;
  },

  // Gán thủ công lead về 1 đơn vị (UnitLeader/Admin)
  assignToUnit: async (leadId: string, unitId: string): Promise<void> => {
    const { error } = await supabase
      .from('crm_leads')
      .update({ unit_id: unitId, assigned_to: null, updated_at: new Date().toISOString() })
      .eq('id', leadId);
    if (error) throw error;
  },
};

