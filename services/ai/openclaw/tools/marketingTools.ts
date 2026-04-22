// @ts-nocheck
import type { OpenClawTool, UserContext } from '../types';
import { dataClient as supabase } from '../../../../lib/dataClient';

// ═══════════════════════════════════════════════
// Tool 1: Soạn Draft MXH & Lưu Pipeline
// ═══════════════════════════════════════════════
export const draftSocialPostTool: OpenClawTool = {
  name: 'draft_social_post',
  description: 'Soạn thảo nội dung MXH đa kênh (Facebook, Zalo, LinkedIn) từ một chủ đề hoặc URL có sẵn và lưu nháp vào cơ sở dữ liệu mkt_pipeline.',
  schema: {
    title: { type: 'string', description: 'Tiêu đề nội dung' },
    source_url: { type: 'string', description: 'URL bài viết gốc (tuỳ chọn)' },
    fb_content: { type: 'string', description: 'Nội dung Facebook (Nhiều emoji, trẻ trung, kết thúc bằng câu hỏi)' },
    zalo_content: { type: 'string', description: 'Nội dung Zalo (Ngắn gọn, súc tích)' },
    linkedin_content: { type: 'string', description: 'Nội dung LinkedIn (Chuyên nghiệp, bullet-points)' },
    focus_keyword: { type: 'string', description: 'Từ khoá SEO tập trung' }
  },
  execute: async (args, context: UserContext) => {
    try {
      // 1. Tạo bản ghi pipeline
      const { data: pipeline, error: pipeErr } = await supabase
        .from('mkt_pipeline')
        .insert({
          title: args.title,
          source_url: args.source_url || null,
          focus_keyword: args.focus_keyword || null,
          status: 'draft',
          created_by: context.userId as any
        })
        .select('id')
        .single();

      if (pipeErr) throw pipeErr;

      // 2. Tạo bản ghi social post
      const { error: socialErr } = await supabase
        .from('mkt_social_posts')
        .insert({
          pipeline_id: pipeline.id,
          fb_content: args.fb_content,
          zalo_content: args.zalo_content,
          linkedin_content: args.linkedin_content,
          fb_status: 'pending',
          linkedin_status: 'pending',
          zalo_status: 'pending',
          created_by: context.userId as any
        });

      if (socialErr) throw socialErr;

      return {
        success: true,
        message: 'Đã tạo bản nháp thành công MXH đa kênh.',
        pipeline_id: pipeline.id,
        preview_fb: args.fb_content.substring(0, 50) + '...',
      };
    } catch (error: any) {
      return { error: 'Lỗi tạo bài nháp: ' + error.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 2: Lên lịch đăng bài MXH
// ═══════════════════════════════════════════════
export const scheduleSocialPostTool: OpenClawTool = {
  name: 'schedule_social_post',
  description: 'Lên lịch xuất bản bài đăng MXH đã chọn trong database vào một thời điểm cụ thể.',
  schema: {
    pipeline_id: { type: 'string', description: 'ID của bài viết trong mkt_pipeline' },
    scheduled_time: { type: 'string', description: 'Thời gian đăng dự kiến (Định dạng: YYYY-MM-DDTHH:mm:ssZ)' }
  },
  execute: async (args, context: UserContext) => {
    try {
      const { error } = await supabase
        .from('mkt_social_posts')
        .update({
          scheduled_for: args.scheduled_time
        })
        .eq('pipeline_id', args.pipeline_id);

      if (error) throw error;

      return {
        success: true,
        message: `Đã lên lịch đăng công việc thành công vào lúc ${args.scheduled_time}.`
      };
    } catch (error: any) {
      return { error: 'Lỗi lên lịch: ' + error.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 3: Phân tích và Tối ưu bài viết SEO
// ═══════════════════════════════════════════════
export const analyzeSeoContentTool: OpenClawTool = {
  name: 'analyze_seo_content',
  description: 'Nhận nội dung nháp hoặc text bài viết và thực hiện audit/tối ưu SEO. LLM tự động trả về nội dung cải thiện sau khi gọi.',
  schema: {
    content: { type: 'string', description: 'Nội dung bài viết cần tối ưu' },
    focus_keyword: { type: 'string', description: 'Từ khóa SEO chính' },
    target_audience: { type: 'string', description: 'Thị trường/Khách hàng mục tiêu' }
  },
  execute: async (args) => {
    // Với tool này, Agent logic có thể tự xử lý dữ liệu trả về để gen ra plan. 
    // Chúng ta chỉ cần trả lại hướng dẫn meta cho mô hình để nó sửa tiếp
    const wordCount = args.content.split(/\s+/).length;
    const keywordCount = (args.content.match(new RegExp(args.focus_keyword, 'gi')) || []).length;
    const keywordDensity = ((keywordCount / wordCount) * 100).toFixed(2);

    let seoFeedback = [];
    if (parseFloat(keywordDensity) < 1.5) seoFeedback.push(`Mật độ từ khóa "${args.focus_keyword}" quá thấp (${keywordDensity}%). Cần tăng lên khoảng 1.5-3%.`);
    if (parseFloat(keywordDensity) > 3) seoFeedback.push(`Mật độ từ khóa "${args.focus_keyword}" quá cao (${keywordDensity}% - nhồi nhét từ khóa). Cần giảm xuống 1.5-3%.`);
    if (wordCount < 500) seoFeedback.push(`Bài viết quá ngắn (${wordCount} chữ). Bổ sung thêm nội dung chuyên sâu.`);

    return {
      current_metrics: {
        word_count: wordCount,
        keyword_density: `${keywordDensity}%`,
        status: seoFeedback.length > 0 ? 'Cần cải thiện' : 'Tốt',
      },
      technical_feedback: seoFeedback,
      instruction: 'Hãy sử dụng phản hồi trên để tự viết lại một phiên bản bài viết hoàn chỉnh và tối ưu SEO hơn, rồi gửi cho người dùng.'
    };
  }
};

// ═══════════════════════════════════════════════
// Tool 4: Generate Newsletter
// ═══════════════════════════════════════════════
export const generateNewsletterTool: OpenClawTool = {
  name: 'generate_newsletter',
  description: 'Tạo nội dung Newsletter/Email hàng tuần và lưu thành Campaign nháp trong mkt_campaigns.',
  schema: {
    campaign_name: { type: 'string', description: 'Tên chiến dịch (VD: Bản tin T4/2026)' },
    subject: { type: 'string', description: 'Tiêu đề (Subject) của Email. Cần hấp dẫn, gây tò mò hoặc có ích.' },
    html_content: { type: 'string', description: 'Nội dung Email (Định dạng HTML, thiết kế đẹp mắt)' }
  },
  execute: async (args, context: UserContext) => {
    try {
      const { data, error } = await supabase
        .from('mkt_campaigns')
        .insert({
          name: args.campaign_name,
          subject: args.subject,
          html_template: args.html_content,
          status: 'draft',
          created_by: context.userId as any
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        success: true,
        campaign_id: data.id,
        message: 'Đã tạo bản nháp Newsletter thành công.'
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 5: Lên lịch Email Campaign
// ═══════════════════════════════════════════════
export const scheduleEmailCampaignTool: OpenClawTool = {
  name: 'schedule_email_campaign',
  description: 'Lên lịch để gửi chiến dịch Email Marketing.',
  schema: {
    campaign_id: { type: 'string', description: 'ID chiến dịch' },
    scheduled_time: { type: 'string', description: 'Thời gian gửi dự kiến (Định dạng: YYYY-MM-DDTHH:mm:ssZ)' }
  },
  execute: async (args) => {
    try {
      const { error } = await supabase
        .from('mkt_campaigns')
        .update({
          scheduled_for: args.scheduled_time,
          status: 'scheduled'
        })
        .eq('id', args.campaign_id);

      if (error) throw error;

      return {
        success: true,
        message: `Đã đổi trạng thái chiến dịch thành "scheduled" gửi lúc ${args.scheduled_time}`
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 6: Đọc nội dung bài viết từ URL 
// ═══════════════════════════════════════════════
export const readWebUrlTool: OpenClawTool = {
  name: 'read_web_url',
  description: 'Truy cập vào một URL để đọc nội dung bài viết. Rất hữu ích khi người dùng cung cấp đường link để yêu cầu tổng hợp hoặc lấy thông tin.',
  schema: {
    url: { type: 'string', description: 'Đường dẫn URL của bài viết (vd: https://....)' }
  },
  execute: async (args) => {
    try {
      const response = await fetch(`https://r.jina.ai/${args.url}`, {
        headers: { 'Accept': 'text/plain' }
      });
      let text = await response.text();
      // Cắt ngắn nếu quá dài
      if (text.length > 15000) {
        text = text.substring(0, 15000) + '...[Nội dung đã bị cắt bớt]';
      }
      return { success: true, url: args.url, content: text };
    } catch (err: any) {
      return { error: 'Không thể đọc nội dung link: ' + err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 7: Web Search (Jina Search API)
// ═══════════════════════════════════════════════
export const webSearchTool: OpenClawTool = {
  name: 'web_search',
  description: 'Tìm kiếm thông tin trên internet. Trả về nội dung web. Phù hợp để quét dự án mới, kiểm tra thông tin công ty, tìm thông tin liên hệ / tin tức.',
  schema: {
    query: { type: 'string', description: 'Từ khóa tìm kiếm (VD: dự án bất động sản sắp khởi công tại miền Bắc 2026)' },
    limit: { type: 'number', description: 'Số kết quả tối đa (mặc định 5)' }
  },
  execute: async (args) => {
    try {
      const q = encodeURIComponent(args.query);
      const limit = args.limit || 5;
      const response = await fetch(`https://s.jina.ai/${q}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      const data = await response.json();
      return { success: true, query: args.query, results: data?.data?.slice(0, limit) || [] };
    } catch (err: any) {
      return { error: 'Không thể tìm kiếm: ' + err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 8: Lưu thông tin khách hàng (Lead Hunter)
// ═══════════════════════════════════════════════
export const saveLeadTool: OpenClawTool = {
  name: 'save_lead',
  description: 'Lưu hoặc cập nhật hồ sơ khách hàng tiềm năng vào danh sách (Lead pipeline). Rất quan trọng khi dùng ở cuối quy trình dò quét web.',
  schema: {
    company_name: { type: 'string', description: 'Tên công ty / tổ chức mục tiêu' },
    project_name: { type: 'string', description: 'Tên dự án liên quan (khởi công / cấp phép)' },
    industry: { type: 'string', description: 'Ngành nghề: Y tế, BĐS, Công nghiệp, Hạ tầng...' },
    potential_score: { type: 'number', description: 'Điểm tiềm năng (0 - 100)' },
    service_need: { type: 'string', description: 'Nhu cầu khả dĩ: Kiểm kê GHG, tư vấn BIM, ...' },
    urgency_reason: { type: 'string', description: 'Tín hiệu mua hàng/lý do cấp thiết' },
    decision_makers: {
      type: 'array',
      items: { type: 'string' },
      description: 'Danh sách nhân sự/vai trò có thể hoặc đã truy xuất được. Dạng chuỗi hoặc JSON'
    },
    contact_approach: { type: 'string', description: 'Cách thức tiệp cận đề xuất' }
  },
  execute: async (args, context: UserContext) => {
    try {
      const { data, error } = await supabase
        .from('mkt_leads')
        .insert({
          company_name: args.company_name,
          project_name: args.project_name || null,
          industry: args.industry || null,
          potential_score: args.potential_score || 0,
          service_need: args.service_need || null,
          urgency_reason: args.urgency_reason || null,
          decision_makers: args.decision_makers || [],
          contact_approach: args.contact_approach || null,
          created_by: context.userId as any,
          status: 'new'
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        success: true,
        message: `Đã lưu thành công hồ sơ lead cho công ty ${args.company_name}. Điểm: ${args.potential_score}.`,
        lead_id: data.id
      };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};

// ═══════════════════════════════════════════════
// Tool 9: Đọc danh sách Leads
// ═══════════════════════════════════════════════
export const getLeadsTool: OpenClawTool = {
  name: 'get_leads',
  description: 'Lấy các hồ sơ lead hiện có trong cơ sở dữ liệu để xem hoặc cập nhật. Trả về top lead có điểm cao.',
  schema: {
    status: { type: 'string', description: 'Trạng thái lead (new, contacted, qualified, closed)' },
    limit: { type: 'number', description: 'Số lượng tối đa' }
  },
  execute: async (args) => {
    try {
      let query = supabase.from('mkt_leads').select('*').order('potential_score', { ascending: false });

      if (args.status) {
        query = query.eq('status', args.status);
      }
      query = query.limit(args.limit || 10);

      const { data, error } = await query;
      if (error) throw error;

      return { success: true, count: data.length, leads: data };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};


// Mảng tools gom nhóm
export const marketingToolsRegistry: OpenClawTool[] = [
  draftSocialPostTool,
  scheduleSocialPostTool,
  analyzeSeoContentTool,
  generateNewsletterTool,
  scheduleEmailCampaignTool,
  readWebUrlTool,
  webSearchTool,
  saveLeadTool,
  getLeadsTool
];
