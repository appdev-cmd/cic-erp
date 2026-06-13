/**
 * Rà soát toàn bộ articles: clean content → set pending → AI phân tích
 * 
 * Usage: node scripts/reprocess-articles.mjs
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────
const SUPABASE_URL = 'https://jyohocjsnsyfgfsmjfqx.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY 
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || '';

const VLLM_URL = process.env.VITE_VLLM_URL || 'https://ai-api.cic.com.vn:9443';
const VLLM_KEY = process.env.VITE_LITELLM_KEY || 'sk-cic-2026';
const MODEL = 'qwen3.5-35b';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Content Cleaner (same logic as crawl.ts) ────────
function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)));
}

function cleanContent(html, maxLength = 2000) {
  if (!html) return '';
  let text = html;
  text = text.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/<[^>]*>/g, ' ');
  text = decodeHTMLEntities(text);
  text = text.replace(/https?:\/\/\S{80,}/g, '');
  text = text.replace(/\{[^}]{20,}\}/g, ' ');
  text = text.replace(/\b(advertisement|sponsored|cookie\s*policy|privacy\s*policy|terms\s*of\s*(service|use))\b/gi, '');
  text = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (text.length > maxLength) {
    text = text.substring(0, maxLength).replace(/\s\S*$/, '') + '…';
  }
  return text;
}

// ─── AI Analysis Prompt ──────────────────────────────
function buildPrompt(article) {
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
  "content_vi": "DỊCH TOÀN BỘ nội dung sang tiếng Việt tự nhiên, đầy đủ, KHÔNG tóm tắt; giữ tên riêng/thuật ngữ. Không có nội dung thì để chuỗi rỗng.",
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

// ─── Call VLLM API ───────────────────────────────────
async function callAI(prompt) {
  const response = await fetch(`${VLLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VLLM_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 8000,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`VLLM API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');
  return JSON.parse(jsonMatch[0]);
}

// ─── Main ────────────────────────────────────────────
async function main() {
  console.log('=== Rà soát toàn bộ articles ===\n');

  // Step 1: Fetch all articles
  console.log('[1/3] Đang tải danh sách bài viết...');
  const { data: articles, error } = await supabase
    .from('tech_articles')
    .select('id, title, url, summary, content, status')
    .order('crawled_at', { ascending: true });

  if (error) {
    console.error('Lỗi tải articles:', error.message);
    process.exit(1);
  }

  console.log(`  → Tìm thấy ${articles.length} bài viết\n`);

  if (articles.length === 0) {
    console.log('Không có bài viết nào. Kết thúc.');
    process.exit(0);
  }

  // Step 2: Clean content + set pending
  console.log('[2/3] Clean content + đánh dấu pending...');
  let cleanedCount = 0;

  for (const article of articles) {
    const cleanedSummary = cleanContent(article.summary || '', 500);
    const cleanedContent = cleanContent(article.content || '', 3000);

    const { error: updateErr } = await supabase
      .from('tech_articles')
      .update({
        summary: cleanedSummary || article.summary,
        content: cleanedContent || article.content,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', article.id);

    if (updateErr) {
      console.error(`  ✗ Lỗi update "${article.title.substring(0, 50)}": ${updateErr.message}`);
    } else {
      cleanedCount++;
    }
  }
  console.log(`  → Đã clean ${cleanedCount}/${articles.length} bài, tất cả đánh dấu pending\n`);

  // Step 3: AI Analysis
  console.log('[3/3] Bắt đầu AI phân tích...');
  console.log(`  VLLM: ${VLLM_URL}`);
  console.log(`  Model: ${MODEL}\n`);

  let analyzed = 0;
  let failed = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const progress = `[${i + 1}/${articles.length}]`;

    try {
      // Mark as analyzing
      await supabase.from('tech_articles')
        .update({ status: 'analyzing' })
        .eq('id', article.id);

      const prompt = buildPrompt({
        ...article,
        summary: cleanContent(article.summary || '', 500),
        content: cleanContent(article.content || '', 3000),
      });

      const result = await callAI(prompt);

      // Update with AI results
      await supabase.from('tech_articles')
        .update({
          title_vi: result.title_vi || article.title,
          summary_vi: result.summary_vi || '',
          content_vi: result.content_vi || '',
          technologies: result.technologies || [],
          technology_category: result.technology_category || 'software_platform',
          project_phases: result.project_phases || [],
          industries: result.industries || [],
          event_type: result.event_type || 'new_solution',
          companies: result.companies || [],
          deployment_project: result.deployment_project || null,
          value_proposition: result.value_proposition || '',
          impact_level: result.impact_level || 'medium',
          impact_reason: result.impact_reason || '',
          tags: result.tags || [],
          ai_analysis: result,
          status: 'analyzed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', article.id);

      analyzed++;
      console.log(`  ${progress} ✅ "${(result.title_vi || article.title).substring(0, 60)}" → ${result.impact_level}`);

    } catch (err) {
      failed++;
      console.error(`  ${progress} ❌ "${article.title.substring(0, 60)}": ${err.message}`);

      // Reset to pending on failure
      await supabase.from('tech_articles')
        .update({ status: 'pending' })
        .eq('id', article.id);
    }

    // Rate limiting: 1s between requests
    if (i < articles.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n=== Hoàn tất ===`);
  console.log(`  ✅ Phân tích thành công: ${analyzed}`);
  console.log(`  ❌ Thất bại: ${failed}`);
  console.log(`  📊 Tổng: ${articles.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
