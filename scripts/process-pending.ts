/**
 * Chạy TOÀN BỘ pipeline mới ngay tại máy (không cần deploy):
 *   pending → giải mã URL Google News → cào content/thumbnail → phân tích Gemini → analyzed
 *
 * Dùng lại đúng decoder + scraper trong api/tech-intel/ để đảm bảo logic giống production.
 *
 * Usage: npx tsx scripts/process-pending.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { scrapeArticlePage } from '../api/tech-intel/crawl';

// ─── Load env ────────────────────────────────────────
function loadEnv(path: string) {
  try {
    for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) {
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch { /* ignore */ }
}
loadEnv('.env');
loadEnv('.env.local');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PRIMARY = 'gemini-3.5-flash';
const FALLBACK = 'gemini-2.5-flash';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ─── Thu thập Gemini keys (DB → env) ─────────────────
async function getKeys(): Promise<string[]> {
  try {
    const { data } = await supabase.from('gemini_keys').select('api_key').eq('is_active', true).neq('status', 'error');
    if (data && data.length) return data.map((r: any) => r.api_key);
  } catch { /* ignore */ }
  const env = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.VITE_GOOGLE_API_KEY || '';
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

// ─── Prompt (đồng bộ techIntelAIService) ─────────────
function buildPrompt(a: { title: string; summary?: string; content?: string; url: string }): string {
  return `Bạn là chuyên gia phân tích công nghệ ngành Xây dựng, Hạ tầng và Công nghiệp (ConTech/AEC).

Hãy phân tích bài viết sau và trả về JSON THUẦN (không có markdown, không có \`\`\`):

TIÊU ĐỀ: ${a.title}
${a.summary ? `TÓM TẮT: ${a.summary}` : ''}
${a.content ? `NỘI DUNG: ${a.content.substring(0, 6000)}` : ''}
URL: ${a.url}

Trả về JSON với cấu trúc chính xác sau:
{
  "title_vi": "...","summary_vi": "...",
  "content_vi": "DỊCH TOÀN BỘ nội dung sang tiếng Việt tự nhiên, đầy đủ, KHÔNG tóm tắt; giữ tên riêng/thuật ngữ. Không có nội dung thì để chuỗi rỗng.",
  "technologies": ["..."],
  "technology_category": "software_platform|ai_solution|robotics_automation|consulting|green_certification|energy_emission",
  "project_phases": ["survey|design|planning|construction|project_management|handover|operations|monitoring"],
  "industries": ["civil|industrial|infrastructure|energy|oil_gas|power|mining|materials|manufacturing"],
  "event_type": "product_launch|new_solution|project_announcement|new_customer|partnership|case_study|conference|webinar|white_paper|review|pilot_project|large_deployment",
  "companies": ["..."],"deployment_project": null,"value_proposition": "...",
  "impact_level": "low|medium|high|breakthrough","impact_reason": "...","tags": ["..."]
}
QUY TẮC: impact_level="breakthrough" chỉ khi thay đổi cục diện ngành; "high" khi ảnh hưởng rộng. technologies liệt kê TÊN CỤ THỂ. CHỈ trả JSON.`;
}

async function callGemini(model: string, prompt: string, keys: string[]): Promise<string> {
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  let lastErr = '';
  for (const key of shuffled.slice(0, Math.min(keys.length, 4))) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: `models/${model}`,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 8000, // dịch toàn văn content_vi + reasoning + JSON → cần nhiều room hơn
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(55000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
      lastErr = `${res.status} ${(await res.text()).substring(0, 120)}`;
      if ([429, 403, 401, 404].includes(res.status)) continue; // thử key/model khác
      throw new Error(lastErr);
    } catch (e: any) {
      lastErr = e.message || String(e);
      continue;
    }
  }
  throw new Error(lastErr || 'all keys failed');
}

function parse(content: string): any | null {
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// ─── Main ────────────────────────────────────────────
async function main() {
  console.log('=== Xử lý bài pending: decode → scrape → Gemini ===\n');
  const keys = await getKeys();
  if (!keys.length) { console.error('❌ Không có Gemini key.'); process.exit(1); }
  console.log(`Có ${keys.length} Gemini key. Model: ${PRIMARY} → ${FALLBACK}\n`);

  const { data: pending, error } = await supabase
    .from('tech_articles')
    .select('id, title, url, summary, content, status')
    .eq('status', 'pending')
    .order('crawled_at', { ascending: true });
  if (error) { console.error('❌', error.message); process.exit(1); }
  console.log(`Tìm thấy ${pending?.length || 0} bài pending.\n`);
  if (!pending?.length) return;

  let analyzed = 0, scraped = 0, failed = 0;
  for (let i = 0; i < pending.length; i++) {
    const a = pending[i] as any;
    const tag = `[${i + 1}/${pending.length}]`;
    try {
      await supabase.from('tech_articles').update({ status: 'analyzing' }).eq('id', a.id);

      let { content, summary, url } = a;
      if (!content || content.length < 100) {
        const d = await scrapeArticlePage(url, a.title, summary);
        if (d && Object.keys(d).length) {
          content = d.content || content;
          summary = d.summary || summary;
          if (d.url) url = d.url;
          await supabase.from('tech_articles').update(d).eq('id', a.id);
          scraped++;
        }
      }

      let raw: string;
      try { raw = await callGemini(PRIMARY, buildPrompt({ title: a.title, summary, content, url }), keys); }
      catch { raw = await callGemini(FALLBACK, buildPrompt({ title: a.title, summary, content, url }), keys); }

      const r = parse(raw);
      if (!r) throw new Error('parse JSON fail');

      await supabase.from('tech_articles').update({
        title_vi: r.title_vi || a.title, summary_vi: r.summary_vi || '', content_vi: r.content_vi || '',
        technologies: r.technologies || [], technology_category: r.technology_category || 'software_platform',
        project_phases: r.project_phases || [], industries: r.industries || [],
        event_type: r.event_type || 'new_solution', companies: r.companies || [],
        deployment_project: r.deployment_project || null, value_proposition: r.value_proposition || '',
        impact_level: r.impact_level || 'medium', impact_reason: r.impact_reason || '',
        tags: r.tags || [], ai_analysis: r, status: 'analyzed', updated_at: new Date().toISOString(),
      }).eq('id', a.id);

      analyzed++;
      console.log(`${tag} ✅ ${(r.title_vi || a.title).substring(0, 55)} → ${r.impact_level}`);
    } catch (e: any) {
      failed++;
      console.error(`${tag} ❌ ${a.title.substring(0, 55)}: ${e.message}`);
      await supabase.from('tech_articles').update({ status: 'pending' }).eq('id', a.id);
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n=== Xong: ✅ ${analyzed} phân tích | 🔎 ${scraped} cào nội dung | ❌ ${failed} lỗi ===`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
