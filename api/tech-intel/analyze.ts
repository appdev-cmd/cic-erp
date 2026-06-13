import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { scrapeArticlePage } from './crawl';

/**
 * Vercel Serverless Function: /api/tech-intel/analyze
 *
 * Phân tích AI các bài viết đang "pending" — CHẠY PHÍA SERVER (không phụ thuộc
 * trình duyệt admin còn mở hay không). Thiết kế chạy theo "time budget": xử lý
 * lần lượt cho đến khi gần hết hạn mức (maxDuration) rồi trả về, để cron gọi lại
 * dọn nốt phần còn lại.
 *
 * Trước khi phân tích, nếu bài chưa có content (đặc biệt là bài Google News),
 * hàm sẽ tự cào (scrape) + giải mã URL gốc để AI có dữ liệu chất lượng hơn.
 *
 * Usage:
 *   POST /api/tech-intel/analyze
 *   Body: { limit?: number, articleIds?: string[] }
 *   - Cron gọi không kèm body → tự lấy bài pending cũ nhất.
 *   - Có thể bảo vệ bằng header Authorization: Bearer <CRON_SECRET>.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

// Ngân sách thời gian mỗi lần gọi (ms) — phải nhỏ hơn maxDuration của function.
const TIME_BUDGET_MS = 50_000;
// Model ưu tiên Gemini Flash (theo cấu hình hệ thống). Có thể bị ghi đè bởi agent-contech.
const DEFAULT_PRIMARY = 'gemini-3.5-flash';
const DEFAULT_FALLBACK = 'gemini-2.5-flash';

// ─── AI model config (đọc từ agent-contech) ───────────
async function getModels(supabase: any): Promise<{ primary: string; fallback: string }> {
  try {
    const { data } = await supabase
      .from('agent_configs')
      .select('preferred_model, fallback_model')
      .eq('id', 'agent-contech')
      .single();
    const primary = (data?.preferred_model as string) || DEFAULT_PRIMARY;
    let fallback = (data?.fallback_model as string) || DEFAULT_FALLBACK;
    // Đảm bảo fallback KHÁC primary để retry có ý nghĩa
    if (fallback === primary) fallback = primary === DEFAULT_FALLBACK ? DEFAULT_PRIMARY : DEFAULT_FALLBACK;
    return { primary, fallback };
  } catch {
    return { primary: DEFAULT_PRIMARY, fallback: DEFAULT_FALLBACK };
  }
}

// ─── Analysis prompt (đồng bộ với techIntelAIService) ──
function buildAnalysisPrompt(article: { title: string; summary?: string; content?: string; url: string }): string {
  return `Bạn là chuyên gia phân tích công nghệ ngành Xây dựng, Hạ tầng và Công nghiệp (ConTech/AEC).

Hãy phân tích bài viết sau và trả về JSON THUẦN (không có markdown, không có \`\`\`):

TIÊU ĐỀ: ${article.title}
${article.summary ? `TÓM TẮT: ${article.summary}` : ''}
${article.content ? `NỘI DUNG: ${article.content.substring(0, 6000)}` : ''}
URL: ${article.url}

Trả về JSON với cấu trúc chính xác sau:
{
  "title_vi": "Tiêu đề dịch sang tiếng Việt tự nhiên",
  "summary_vi": "Tóm tắt 2-3 câu bằng tiếng Việt, nêu rõ công nghệ gì, ai phát triển, ứng dụng ra sao",
  "content_vi": "DỊCH TOÀN BỘ nội dung bài viết sang tiếng Việt tự nhiên, mạch lạc, giữ nguyên đầy đủ ý và các đoạn. Giữ nguyên tên riêng/tên công ty/thuật ngữ kỹ thuật khi cần. Đây là bản dịch chính để người đọc Việt Nam đọc, KHÔNG phải tóm tắt — phải dịch hết nội dung được cung cấp. Nếu không có nội dung thì để chuỗi rỗng.",
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
- Nếu không rõ một trường, dùng giá trị mặc định hợp lý
- CHỈ trả JSON, không giải thích thêm`;
}

// ─── Gọi AI proxy (tái dùng key rotation của ai-proxy) ─
function getAiProxyBase(): string {
  if (process.env.AI_PROXY_BASE) return process.env.AI_PROXY_BASE;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function callAI(model: string, prompt: string, timeoutMs: number): Promise<string> {
  const res = await fetch(`${getAiProxyBase()}/api/ai-proxy/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8000, // dịch toàn văn content_vi + reasoning + JSON → cần nhiều room hơn
      stream: false,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${body.substring(0, 120)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseAnalysis(content: string): Record<string, any> | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Bảo vệ bằng CRON_SECRET nếu được cấu hình (cron của Vercel gửi Authorization)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    const provided = auth.replace(/^Bearer\s+/i, '');
    // Cho phép gọi từ UI đã đăng nhập (không có secret) HOẶC cron có secret đúng.
    // Chỉ chặn khi có header sai secret rõ ràng (tránh lạm dụng từ bên ngoài).
    if (auth && provided !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase chưa được cấu hình (thiếu URL/KEY).' });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const limit: number = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
  const articleIds: string[] | undefined = Array.isArray(body.articleIds) ? body.articleIds : undefined;

  const { primary, fallback } = await getModels(supabase);

  // Lấy danh sách bài cần phân tích
  let pending: any[] = [];
  try {
    if (articleIds && articleIds.length > 0) {
      const { data } = await supabase
        .from('tech_articles')
        .select('id, title, url, summary, content, status')
        .in('id', articleIds);
      pending = data || [];
    } else {
      const { data } = await supabase
        .from('tech_articles')
        .select('id, title, url, summary, content, status')
        .eq('status', 'pending')
        .order('crawled_at', { ascending: true })
        .limit(limit);
      pending = data || [];
    }
  } catch (err: any) {
    return res.status(500).json({ error: `Lỗi tải bài pending: ${err.message}` });
  }

  const started = Date.now();
  let analyzed = 0;
  let scraped = 0;
  let failed = 0;
  let processed = 0;

  for (const article of pending) {
    if (Date.now() - started > TIME_BUDGET_MS) break; // hết ngân sách → để cron lần sau dọn nốt
    processed++;

    try {
      await supabase.from('tech_articles').update({ status: 'analyzing' }).eq('id', article.id);

      // 1) Nếu chưa có content → cào (kèm giải mã URL Google News)
      let { content, summary, url } = article;
      if (!content || content.length < 100) {
        const data = await scrapeArticlePage(url, article.title, summary);
        if (data && Object.keys(data).length > 0) {
          content = data.content || content;
          summary = data.summary || summary;
          if (data.url) url = data.url;
          await supabase.from('tech_articles').update(data).eq('id', article.id);
          scraped++;
        }
      }

      // 2) Gọi AI (Gemini primary → fallback)
      const prompt = buildAnalysisPrompt({ title: article.title, summary, content, url });
      let raw: string;
      try {
        raw = await callAI(primary, prompt, 55_000);
      } catch (primaryErr) {
        raw = await callAI(fallback, prompt, 55_000);
      }

      const r = parseAnalysis(raw);
      if (!r) throw new Error('Không parse được JSON từ AI');

      await supabase
        .from('tech_articles')
        .update({
          title_vi: r.title_vi || article.title,
          summary_vi: r.summary_vi || '',
          content_vi: r.content_vi || '',
          technologies: r.technologies || [],
          technology_category: r.technology_category || 'software_platform',
          project_phases: r.project_phases || [],
          industries: r.industries || [],
          event_type: r.event_type || 'new_solution',
          companies: r.companies || [],
          deployment_project: r.deployment_project || null,
          value_proposition: r.value_proposition || '',
          impact_level: r.impact_level || 'medium',
          impact_reason: r.impact_reason || '',
          tags: r.tags || [],
          ai_analysis: r,
          status: 'analyzed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', article.id);

      analyzed++;
    } catch (err: any) {
      failed++;
      console.error(`[tech-intel/analyze] Failed ${article.id}:`, err.message || err);
      // Trả về pending để lần sau thử lại
      try {
        await supabase.from('tech_articles').update({ status: 'pending' }).eq('id', article.id);
      } catch { /* ignore */ }
    }
  }

  const remaining = pending.length - processed;
  return res.status(200).json({
    message: `Đã phân tích ${analyzed}/${processed} bài (cào nội dung: ${scraped}, lỗi: ${failed})`,
    analyzed,
    scraped,
    failed,
    processed,
    remaining,
    elapsedMs: Date.now() - started,
    models: { primary, fallback },
  });
}
