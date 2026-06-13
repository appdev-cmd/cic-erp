/**
 * TechIntelAIService — AI analysis pipeline for ConTech articles
 * 
 * Uses VLLM internal API (via /api/ai-proxy) as primary,
 * with Gemini free tier as fallback.
 */

import type {
  TechArticle,
  ArticleAnalysisResult,
  TechCategory,
  ProjectPhase,
  IndustrySector,
  TechEventType,
  ImpactLevel,
  ReportType,
} from '../types/techIntel';
import { TechIntelService } from './techIntelService';
import { AgentConfigService } from './ai/agentConfigService';

// ─── AI Provider Config ───────────────────────────────

const AI_PROXY_URL = '/api/ai-proxy/chat/completions';

// Fallback model — Gemini 3.5 Flash (free tier)
const FALLBACK_MODEL = 'gemini-3.5-flash';

// Get active model + fallback from Agent Config (agent-contech) in DB
async function getModelsForAnalysis(): Promise<{ primary: string; fallback: string }> {
  try {
    const config = await AgentConfigService.getById('agent-contech');
    const primary = config?.preferred_model || FALLBACK_MODEL;
    let fallback = config?.fallback_model || FALLBACK_MODEL;
    // Fallback PHẢI khác primary thì retry mới có ý nghĩa
    if (fallback === primary) fallback = primary === FALLBACK_MODEL ? 'gemini-2.5-flash' : FALLBACK_MODEL;
    return { primary, fallback };
  } catch (err) {
    console.warn('[techIntelAIService] Failed to load agent-contech config:', err);
    return { primary: FALLBACK_MODEL, fallback: 'gemini-2.5-flash' };
  }
}

// ─── Analysis Prompt ──────────────────────────────────

function buildAnalysisPrompt(article: { title: string; summary?: string; content?: string; url: string }): string {
  return `Bạn là chuyên gia phân tích công nghệ ngành Xây dựng, Hạ tầng và Công nghiệp (ConTech/AEC).

Hãy phân tích bài viết sau và trả về JSON THUẦN (không có markdown, không có \`\`\`):

TIÊU ĐỀ: ${article.title}
${article.summary ? `TÓM TẮT: ${article.summary}` : ''}
${article.content ? `NỘI DUNG: ${article.content.substring(0, 8000)}` : ''}
URL: ${article.url}

Trả về JSON với cấu trúc chính xác sau:
{
  "title_vi": "Tiêu đề dịch sang tiếng Việt tự nhiên",
  "summary_vi": "Tóm tắt 2-3 câu bằng tiếng Việt, nêu rõ công nghệ gì, ai phát triển, ứng dụng ra sao",
  "content_vi": "DỊCH TOÀN BỘ nội dung bài viết sang tiếng Việt tự nhiên, mạch lạc, giữ nguyên đầy đủ ý và các đoạn. Giữ nguyên tên riêng/tên công ty/thuật ngữ kỹ thuật khi cần. Đây là bản dịch chính để người đọc Việt Nam đọc, KHÔNG phải tóm tắt — phải dịch hết nội dung được cung cấp.",
  "technologies": ["Tên công nghệ cụ thể, ví dụ: BIM, Digital Twin, LiDAR"],
  "technology_category": "Một trong: software_platform | ai_solution | robotics_automation | consulting | green_certification | energy_emission",
  "project_phases": ["Một hoặc nhiều trong: survey | design | planning | construction | project_management | handover | operations | monitoring"],
  "industries": ["Một hoặc nhiều trong: civil | industrial | infrastructure | energy | oil_gas | power | mining | materials | manufacturing"],
  "event_type": "Một trong: product_launch | new_solution | project_announcement | new_customer | partnership | case_study | conference | webinar | white_paper | review | pilot_project | large_deployment",
  "companies": ["Tên công ty liên quan"],
  "deployment_project": "Tên dự án triển khai cụ thể nếu có, hoặc null",
  "value_proposition": "Giá trị cốt lõi mang lại (1-2 câu tiếng Việt)",
  "impact_level": "Một trong: low | medium | high | breakthrough",
  "impact_reason": "Lý giải mức ảnh hưởng (1-2 câu tiếng Việt)",
  "tags": ["Từ khóa liên quan, tối đa 5"]
}

QUY TẮC:
- impact_level = "breakthrough" chỉ khi công nghệ CÓ THỂ THAY ĐỔI CỤC DIỆN ngành
- impact_level = "high" khi ảnh hưởng rộng nhưng chưa đột phá
- technologies: liệt kê TÊN CỤ THỂ (BIM, AI, Robot...), không phải mô tả chung
- content_vi: dịch ĐẦY ĐỦ toàn bộ nội dung được cung cấp sang tiếng Việt (không cắt ngắn, không tóm lược); nếu không có nội dung thì để chuỗi rỗng
- Nếu không rõ một trường, dùng giá trị mặc định hợp lý
- CHỈ trả JSON, không giải thích thêm`;
}

// ─── Report Generation Prompts ────────────────────────

function buildReportPrompt(
  type: ReportType,
  articles: TechArticle[],
  periodStart: string,
  periodEnd: string,
): string {
  const articleSummaries = articles.slice(0, 50).map((a, i) =>
    `${i + 1}. [${a.impactLevel?.toUpperCase()}] ${a.titleVi || a.title}\n   Công nghệ: ${a.technologies.join(', ')}\n   Ngành: ${a.industries.join(', ')}\n   Tóm tắt: ${a.summaryVi || a.summary || 'N/A'}`
  ).join('\n\n');

  const reportTypeMap: Record<ReportType, string> = {
    weekly: 'BẢN TIN CÔNG NGHỆ TUẦN',
    monthly: 'BÁO CÁO XU HƯỚNG THÁNG',
    quarterly: 'BÁO CÁO CẠNH TRANH & ĐẦU TƯ QUÝ',
    custom: 'BÁO CÁO TỔNG HỢP',
  };

  return `Bạn là chuyên gia phân tích công nghệ ngành Xây dựng & Hạ tầng.

Hãy viết ${reportTypeMap[type]} cho kỳ ${periodStart} đến ${periodEnd}.

DANH SÁCH ${articles.length} TIN TỨC TRONG KỲ:
${articleSummaries}

YÊU CẦU BÁO CÁO (viết bằng Markdown):
${type === 'weekly' ? `
## Bản tin tuần
1. **Tổng quan tuần**: Số lượng tin, highlight chính
2. **Tin nổi bật**: Top 3-5 tin quan trọng nhất với phân tích
3. **Xu hướng tuần**: Các công nghệ/chủ đề được nhắc nhiều
4. **Đáng chú ý**: Sự kiện, hội thảo, sản phẩm mới
` : type === 'monthly' ? `
## Báo cáo xu hướng tháng
1. **Executive Summary**: Tổng quan xu hướng tháng
2. **Phân tích chuyên sâu**: Phân tích theo nhóm công nghệ (A1-A6)
3. **Phân tích theo ngành**: Highlight từng ngành CN
4. **Xu hướng đáng theo dõi**: Dự báo tháng tới
5. **Cơ hội kinh doanh**: Nhận diện cơ hội mới
6. **Danh sách đối tác tiềm năng**: Công ty/startup nổi bật
` : `
## Báo cáo cạnh tranh & đầu tư quý
1. **Tổng quan quý**: Executive summary
2. **Bức tranh tài chính**: Vốn đầu tư, gọi vốn startup
3. **Thương vụ chiến lược**: M&A, partnerships, alliances
4. **Bảng xếp hạng công nghệ**: Công nghệ hot nhất quý
5. **Phân tích cạnh tranh**: So sánh giải pháp
6. **Dự báo & Khuyến nghị**: Hành động đề xuất
`}

QUAN TRỌNG:
- Viết chuyên nghiệp nhưng dễ hiểu
- Dùng heading cấp 2 (##) và cấp 3 (###)
- Thêm bullet points và bảng khi phù hợp
- Kết thúc bằng "Khuyến nghị hành động"`;
}

// ─── Service Methods ──────────────────────────────────

export const TechIntelAIService = {

  /**
   * Analyze a single article using AI
   */
  async analyzeArticle(article: TechArticle): Promise<ArticleAnalysisResult> {
    const prompt = buildAnalysisPrompt(article);
    const { primary, fallback } = await getModelsForAnalysis();

    // Helper: gọi AI với 1 model cụ thể
    const callAI = async (model: string, timeoutMs: number): Promise<Response> => {
      return fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 8000, // dịch toàn văn content_vi + reasoning + JSON → cần nhiều room hơn
          stream: false,
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    };

    let lastResponse: Response;

    try {
      // ai-proxy bị Vercel giới hạn ở maxDuration 60s → client chờ tối đa 58s
      // để kịp nhận phản hồi/lỗi trước khi function bị kill.
      const primaryTimeout = 58000;
      console.log(`[TechIntelAI] Analyzing with primary model: ${primary}`);
      lastResponse = await callAI(primary, primaryTimeout);

      // Retry 429 (rate limit) cho Gemini
      if (lastResponse.status === 429 && primary.startsWith('gemini-')) {
        for (let retry = 0; retry < 3; retry++) {
          const delay = Math.pow(2, retry + 1) * 1000;
          console.warn(`[TechIntelAI] Rate limited (429), retrying in ${delay/1000}s... (${retry + 1}/3)`);
          await new Promise(r => setTimeout(r, delay));
          lastResponse = await callAI(primary, 60000);
          if (lastResponse.ok || lastResponse.status !== 429) break;
        }
      }
    } catch (primaryErr: any) {
      // Model chính fail (timeout, network error) → thử fallback
      if (primary !== fallback) {
        console.warn(`[TechIntelAI] Primary model "${primary}" failed: ${primaryErr.message}. Trying fallback "${fallback}"...`);
        try {
          lastResponse = await callAI(fallback, 60000);
        } catch (fallbackErr: any) {
          throw new Error(`Cả 2 model đều thất bại: ${primary} (${primaryErr.message}), ${fallback} (${fallbackErr.message})`);
        }
      } else {
        throw primaryErr;
      }
    }

    // Nếu primary trả lỗi (không phải exception) → thử fallback
    if (!lastResponse!.ok && primary !== fallback) {
      const errStatus = lastResponse!.status;
      console.warn(`[TechIntelAI] Primary model "${primary}" returned ${errStatus}. Trying fallback "${fallback}"...`);
      try {
        lastResponse = await callAI(fallback, 60000);
      } catch (fallbackErr: any) {
        throw new Error(`Fallback "${fallback}" cũng thất bại: ${fallbackErr.message}`);
      }
    }

    if (!lastResponse!.ok) {
      const errBody = await lastResponse!.text().catch(() => '');
      if (lastResponse!.status === 429) {
        throw new Error('Tất cả API keys đang bị rate limit. Vui lòng thử lại sau 1-2 phút.');
      }
      throw new Error(`AI analysis failed: ${lastResponse!.status} - ${errBody.substring(0, 100)}`);
    }

    const data = await lastResponse!.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response
    try {
      // Try to extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in AI response');

      const result = JSON.parse(jsonMatch[0]);

      return {
        titleVi: result.title_vi || article.title,
        summaryVi: result.summary_vi || '',
        contentVi: result.content_vi || '',
        technologies: result.technologies || [],
        technologyCategory: result.technology_category as TechCategory || 'software_platform',
        projectPhases: (result.project_phases || []) as ProjectPhase[],
        industries: (result.industries || []) as IndustrySector[],
        eventType: result.event_type as TechEventType || 'new_solution',
        companies: result.companies || [],
        deploymentProject: result.deployment_project || undefined,
        valueProposition: result.value_proposition || '',
        impactLevel: result.impact_level as ImpactLevel || 'medium',
        impactReason: result.impact_reason || '',
        tags: result.tags || [],
      };
    } catch (parseError) {
      console.error('[TechIntelAI] Failed to parse AI response:', content.substring(0, 200));
      // Return default analysis
      return {
        titleVi: article.title,
        summaryVi: article.summary || '',
        contentVi: '',
        technologies: [],
        technologyCategory: 'software_platform',
        projectPhases: [],
        industries: [],
        eventType: 'new_solution',
        companies: [],
        valueProposition: '',
        impactLevel: 'medium',
        impactReason: 'Không thể phân tích tự động',
        tags: [],
      };
    }
  },

  /**
   * Analyze and update an article in DB
   */
  async analyzeAndUpdateArticle(articleId: string): Promise<TechArticle> {
    const article = await TechIntelService.getArticleById(articleId);
    if (!article) throw new Error('Bài viết không tồn tại');

    // Mark as analyzing
    await TechIntelService.updateArticle(articleId, { status: 'analyzing' });

    try {
      const analysis = await this.analyzeArticle(article);

      // Update article with AI results
      return await TechIntelService.updateArticle(articleId, {
        titleVi: analysis.titleVi,
        summaryVi: analysis.summaryVi,
        contentVi: analysis.contentVi,
        technologies: analysis.technologies,
        technologyCategory: analysis.technologyCategory,
        projectPhases: analysis.projectPhases,
        industries: analysis.industries,
        eventType: analysis.eventType,
        companies: analysis.companies,
        deploymentProject: analysis.deploymentProject,
        valueProposition: analysis.valueProposition,
        impactLevel: analysis.impactLevel,
        impactReason: analysis.impactReason,
        tags: analysis.tags,
        aiAnalysis: analysis,
        status: 'analyzed',
      });
    } catch (error) {
      // Mark as pending if analysis fails
      await TechIntelService.updateArticle(articleId, { status: 'pending' });
      throw error;
    }
  },

  /**
   * Batch analyze multiple articles
   */
  async batchAnalyze(articleIds: string[], onProgress?: (done: number, total: number) => void): Promise<number> {
    let success = 0;
    const total = articleIds.length;
    let completed = 0;

    // Xử lý tuần tự (1 bài/lần) + delay để tránh rate limit 429
    for (const id of articleIds) {
      try {
        await this.analyzeAndUpdateArticle(id);
        success++;
      } catch (err) {
        console.error(`[TechIntelAI] Failed to analyze ${id}:`, err);
      } finally {
        completed++;
        onProgress?.(completed, total);
      }

      // Delay 1.5s giữa mỗi bài để tránh rate limit
      if (completed < total) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return success;
  },

  /**
   * Generate a report from articles in a time period
   */
  async generateReport(
    type: ReportType,
    periodStart: string,
    periodEnd: string,
  ): Promise<string> {
    // Fetch articles for the period
    const { articles } = await TechIntelService.getArticles({
      dateFrom: periodStart,
      dateTo: periodEnd,
      status: 'analyzed',
      sortBy: 'impact',
      pageSize: 100,
    });

    if (articles.length === 0) {
      return '# Không có tin tức\n\nKhông tìm thấy tin tức nào trong khoảng thời gian này.';
    }

    const prompt = buildReportPrompt(type, articles, periodStart, periodEnd);
    const { primary, fallback } = await getModelsForAnalysis();

    let response: Response;
    try {
      const timeout = 58000; // đồng bộ với maxDuration 60s của ai-proxy
      response = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: primary,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 4000,
          stream: false,
        }),
        signal: AbortSignal.timeout(timeout),
      });
    } catch (err: any) {
      if (primary !== fallback) {
        console.warn(`[TechIntelAI] Report: primary "${primary}" failed, trying fallback "${fallback}"`);
        response = await fetch(AI_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: fallback,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 4000,
            stream: false,
          }),
          signal: AbortSignal.timeout(60000),
        });
      } else {
        throw err;
      }
    }

    if (!response!.ok) {
      throw new Error(`Report generation failed: ${response!.status}`);
    }

    const data = await response!.json();
    return data.choices?.[0]?.message?.content || '';
  },
};
