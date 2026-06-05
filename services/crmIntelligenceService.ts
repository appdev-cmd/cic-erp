/**
 * CrmIntelligenceService — AI Lead Intelligence
 * ==============================================
 * Phân tích lead bằng AI (qua gateway sẵn có của CIC):
 *  - Thu thập dữ liệu nội bộ (lịch sử hợp đồng, thông tin lead)
 *  - Gọi AI phân tích → JSON có cấu trúc
 *  - Lưu crm_lead_intelligence + cập nhật crm_leads.ai_score_contribution
 *
 * Ghi chú: bản này gather dữ liệu NỘI BỘ (không gọi web search bên ngoài
 * để tránh phụ thuộc Google API key / Edge Function). Có thể mở rộng sau.
 */

import { chat } from './ai/gateway';
import { dataClient as supabase } from '../lib/dataClient';
import type { CrmLead, CrmLeadIntelligence } from '../types/crm';
import { CIC_PRODUCT_CATALOG } from '../lib/crm/cicProductCatalog';
import { formatCurrency } from '../utils/formatters';

const PROVIDER_KEY = 'cic_lead_intelligence_provider';
const GEMINI_KEY_STORAGE = 'cic_custom_gemini_key';
const LOCAL_MODEL = 'qwen3.5-35b';
const GEMINI_MODEL = 'gemini-2.0-flash';

function selectAIModel(): string {
  try {
    const provider = localStorage.getItem(PROVIDER_KEY);
    const hasGeminiKey = !!localStorage.getItem(GEMINI_KEY_STORAGE);
    if (provider === 'gemini_personal' && hasGeminiKey) return GEMINI_MODEL;
  } catch { /* localStorage không khả dụng */ }
  return LOCAL_MODEL;
}

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  return match?.[1] ? match[1].trim() : text.trim();
}

function buildAnalysisPrompt(lead: CrmLead, contractHistory: string): string {
  const productNames = (lead.products || [])
    .map((p: any) => p.productName || p.product_name)
    .filter(Boolean)
    .join(', ');

  return `Bạn là chuyên gia phân tích khách hàng cho CIC — đơn vị tư vấn BIM và phân phối phần mềm Autodesk tại Việt Nam.

## Thông tin lead cần phân tích:
- Tên lead/tổ chức: ${lead.company_name || lead.title}
- Người liên hệ: ${lead.name || 'Chưa có'}
- Nguồn / ghi chú nguồn: ${lead.source || 'Chưa rõ'} ${lead.source_detail ? '— ' + lead.source_detail : ''}
- Vùng miền: ${lead.region || 'unknown'}
- Sản phẩm quan tâm: ${productNames || 'Chưa rõ'}
- Giá trị ước tính: ${lead.expected_value ? formatCurrency(lead.expected_value) : 'Chưa có'}
- Lịch sử với CIC: ${contractHistory}

## Danh mục sản phẩm/dịch vụ CIC:
${CIC_PRODUCT_CATALOG}

## Yêu cầu:
Phân tích và trả về DUY NHẤT một JSON theo schema sau (không thêm text ngoài):
{
  "company_summary": "Tóm tắt 2-3 câu về tổ chức, lĩnh vực, quy mô (suy luận hợp lý từ tên & thông tin, ghi rõ nếu thiếu dữ liệu)",
  "technology_level": "none|basic|intermediate|advanced",
  "industry_sector": "residential|commercial|infrastructure|industrial|government|consulting|other",
  "project_pipeline": [ { "name": "...", "type": "...", "scale": "...", "status": "planned|ongoing|completed" } ],
  "recommended_products": [
    { "product_id": "revit|navisworks|autocad|bim360|recap|consulting_bim|consulting_pm|training|support",
      "product_name": "...", "fit_score": 0-100, "reasoning": "...",
      "talking_points": ["...","..."], "urgency": "high|medium|low" }
  ],
  "sales_insights": [ { "category": "pain_point|opportunity|risk|news|contact_tip|competitor", "content": "...", "source_url": "" } ],
  "ai_score_contribution": 0-30,
  "ai_score_reasoning": "Giải thích ngắn (1-2 câu)"
}

## Tiêu chí ai_score_contribution:
- 25-30: rất phù hợp (lĩnh vực xây dựng, có nhu cầu BIM rõ, ngân sách lớn)
- 15-24: phù hợp tốt (lĩnh vực trọng tâm, có tín hiệu nhu cầu)
- 8-14: phù hợp trung bình
- 0-7: ít phù hợp / thiếu thông tin (ghi rõ lý do)
Chỉ trả về JSON.`;
}

async function gatherInternal(lead: CrmLead): Promise<string> {
  if (!lead.customer_id) return 'Khách hàng mới — chưa có hợp đồng với CIC.';
  try {
    const { data: contracts } = await supabase
      .from('contracts')
      .select('name')
      .eq('customer_id', lead.customer_id)
      .limit(5);
    if (contracts && contracts.length > 0) {
      return `Đã có ${contracts.length} hợp đồng: ${contracts.map((c: any) => c.name).filter(Boolean).join(', ')}`;
    }
  } catch { /* contracts có thể không truy vấn được */ }
  return 'Khách hàng mới — chưa có hợp đồng với CIC.';
}

export const CrmIntelligenceService = {
  getByLeadId: async (leadId: string): Promise<CrmLeadIntelligence | null> => {
    const { data, error } = await supabase
      .from('crm_lead_intelligence')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();
    if (error) return null;
    return (data as any) || null;
  },

  /**
   * Chạy phân tích AI cho 1 lead. Cập nhật DB và trả về kết quả.
   */
  analyze: async (lead: CrmLead): Promise<CrmLeadIntelligence> => {
    const { data: { user } } = await supabase.auth.getUser();
    const model = selectAIModel();

    // Đánh dấu processing
    await supabase.from('crm_lead_intelligence').upsert(
      { lead_id: lead.id, status: 'processing', triggered_by: user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'lead_id' }
    );
    await supabase.from('crm_leads').update({ intelligence_status: 'processing' }).eq('id', lead.id);

    try {
      const contractHistory = await gatherInternal(lead);
      const prompt = buildAnalysisPrompt(lead, contractHistory);

      const raw = await chat({
        messages: [{ role: 'user', content: prompt }],
        model,
        systemInstruction: 'Bạn là chuyên gia phân tích khách hàng B2B ngành xây dựng/BIM. Luôn trả về JSON hợp lệ.',
        temperature: 0.3,
        maxTokens: 2500,
        meta: { source: 'api' },
      });

      const analysis = JSON.parse(extractJSON(raw));
      const aiScore = Math.max(0, Math.min(30, Number(analysis.ai_score_contribution) || 0));

      const payload = {
        lead_id: lead.id,
        status: 'completed' as const,
        error_message: null,
        company_summary: analysis.company_summary ?? null,
        technology_level: analysis.technology_level ?? null,
        industry_sector: analysis.industry_sector ?? null,
        project_pipeline: analysis.project_pipeline ?? [],
        recommended_products: analysis.recommended_products ?? [],
        sales_insights: analysis.sales_insights ?? [],
        ai_score_contribution: aiScore,
        ai_score_reasoning: analysis.ai_score_reasoning ?? null,
        model_used: model,
        analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await supabase.from('crm_lead_intelligence').upsert(payload, { onConflict: 'lead_id' });
      await supabase.from('crm_leads')
        .update({ intelligence_status: 'completed', ai_score_contribution: aiScore })
        .eq('id', lead.id);

      const { data } = await supabase.from('crm_lead_intelligence').select('*').eq('lead_id', lead.id).single();
      return data as any;
    } catch (err: any) {
      await supabase.from('crm_lead_intelligence').upsert(
        { lead_id: lead.id, status: 'failed', error_message: String(err?.message || err), updated_at: new Date().toISOString() },
        { onConflict: 'lead_id' }
      );
      await supabase.from('crm_leads').update({ intelligence_status: 'failed' }).eq('id', lead.id);
      throw err;
    }
  },
};
