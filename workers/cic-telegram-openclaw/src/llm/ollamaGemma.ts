import { config, ollamaEnabled } from '../config.js';

const YEAR = new Date().getFullYear();

const SYSTEM = `Bạn là Trợ lý CIC. Trả lời CHỈ bằng 1 JSON object {"tool":"...","args":{...}}.

Tools:
chat(message) — chào hỏi, hỏi chung
help() — hướng dẫn
dashboard() — tổng quan công ty
list_contracts(from,to) — danh sách HĐ, from/to là "YYYY-MM-DD" hoặc null
search_contracts(keyword) — tìm HĐ
overdue_payments() — công nợ quá hạn
expiring_contracts(days) — HĐ sắp hết hạn, days mặc định 30
my_tasks() — task của tôi
revenue_report(year) — doanh thu theo tháng, year số hoặc null=năm nay
export_xlsx(from,to) — xuất Excel HĐ
export_docx(from,to) — xuất Word HĐ

Quy tắc:
- Nếu user nói "báo cáo","xuất","lập báo cáo" + "docx"/"word" → export_docx
- Nếu user nói "báo cáo","xuất" + "xlsx"/"excel" → export_xlsx
- "kinh doanh","doanh thu","revenue" → revenue_report
- "quá hạn","nợ" → overdue_payments
- "hết hạn","sắp hết" → expiring_contracts
- "task","việc","công việc" → my_tasks
- "tìm","search" + keyword → search_contracts
- "tổng quan","tình hình" → dashboard
- Chào hỏi → chat
- Năm ${YEAR}. Q1=01-01→03-31, Q2=04-01→06-30, Q3=07-01→09-30, Q4=10-01→12-31

Ví dụ:
User: "lập báo cáo quý 1 file docx" → {"tool":"export_docx","args":{"from":"${YEAR}-01-01","to":"${YEAR}-03-31"}}
User: "doanh thu quý 1" → {"tool":"revenue_report","args":{"year":${YEAR}}}
User: "xin chào" → {"tool":"chat","args":{"message":"Xin chào! Tôi có thể giúp gì?"}}`;

export type ToolName =
  | 'chat' | 'help' | 'dashboard' | 'list_contracts' | 'search_contracts'
  | 'overdue_payments' | 'expiring_contracts' | 'my_tasks' | 'revenue_report'
  | 'export_xlsx' | 'export_docx';

export type ToolDecision = { tool: ToolName; args: Record<string, unknown> };

const VALID_TOOLS: ToolName[] = [
  'chat','help','dashboard','list_contracts','search_contracts',
  'overdue_payments','expiring_contracts','my_tasks','revenue_report',
  'export_xlsx','export_docx',
];

function extractToolFromJson(parsed: unknown): ToolDecision | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;

  let o: { tool?: string; args?: unknown };
  if (Array.isArray(raw.tool_calls) && raw.tool_calls.length > 0) {
    o = raw.tool_calls[0] as typeof o;
  } else if (Array.isArray(raw.tools) && raw.tools.length > 0) {
    o = raw.tools[0] as typeof o;
  } else {
    o = raw as typeof o;
  }

  if (!o.tool || !VALID_TOOLS.includes(o.tool as ToolName)) return null;
  const args = (o.args && typeof o.args === 'object' ? o.args : {}) as Record<string, unknown>;
  return { tool: o.tool as ToolName, args };
}

/** Regex fallback khi LLM trả rỗng hoặc JSON không hợp lệ */
function regexFallback(text: string): ToolDecision | null {
  const t = text.toLowerCase();

  const qMatch = t.match(/qu[ýy]\s*(\d)/);
  const qNum = qMatch ? Number(qMatch[1]) : null;
  const qFrom = qNum ? `${YEAR}-${String((qNum - 1) * 3 + 1).padStart(2, '0')}-01` : null;
  const qTo = qNum ? `${YEAR}-${String(qNum * 3).padStart(2, '0')}-${qNum === 1 || qNum === 4 ? '31' : '30'}` : null;

  const yearMatch = t.match(/n[aă]m\s*(\d{4})/);
  const mentionedYear = yearMatch ? Number(yearMatch[1]) : null;

  if (/xu[ấa]t\s*.*docx|file\s*docx|word|báo\s*cáo.*docx/i.test(t)) {
    return { tool: 'export_docx', args: { from: qFrom, to: qTo } };
  }
  if (/xu[ấa]t\s*.*xlsx|file\s*xlsx|excel|báo\s*cáo.*xlsx|báo\s*cáo.*excel/i.test(t)) {
    return { tool: 'export_xlsx', args: { from: qFrom, to: qTo } };
  }
  if (/doanh\s*thu|kinh\s*doanh|k[ếe]t\s*qu[ảa]\s*kinh\s*doanh|revenue/i.test(t)) {
    return { tool: 'revenue_report', args: { year: mentionedYear ?? YEAR } };
  }
  if (/qu[áa]\s*h[ạa]n|n[ợo]\s*qu[áa]|overdue/i.test(t)) {
    return { tool: 'overdue_payments', args: {} };
  }
  if (/h[ếe]t\s*h[ạa]n|s[ắa]p\s*h[ếe]t|expir/i.test(t)) {
    return { tool: 'expiring_contracts', args: { days: 30 } };
  }
  if (/task|vi[ệe]c|c[ôo]ng\s*vi[ệe]c/i.test(t)) {
    return { tool: 'my_tasks', args: {} };
  }
  if (/t[ổo]ng\s*quan|t[ìi]nh\s*h[ìi]nh|dashboard/i.test(t)) {
    return { tool: 'dashboard', args: {} };
  }
  if (/t[ìi]m|search/i.test(t)) {
    const kw = t.replace(/.*(?:t[ìi]m|search)\s*/i, '').replace(/h[ợo]p\s*[đd][ồo]ng\s*/i, '').trim();
    if (kw.length >= 2) return { tool: 'search_contracts', args: { keyword: kw } };
  }
  if (/h[ợo]p\s*[đd][ồo]ng|danh\s*s[áa]ch/i.test(t)) {
    return { tool: 'list_contracts', args: { from: qFrom, to: qTo } };
  }
  if (/help|h[ưu][ớo]ng\s*d[ẫa]n|gi[úu]p/i.test(t)) {
    return { tool: 'help', args: {} };
  }
  if (/xin\s*ch[àa]o|hello|hi\b|ch[àa]o|alo/i.test(t)) {
    return { tool: 'chat', args: { message: 'Xin chào! Tôi là Trợ lý CIC. Bạn cần tôi giúp gì? Gõ /help để xem hướng dẫn.' } };
  }
  return null;
}

export async function decideTool(
  userText: string,
  contextLines: string[]
): Promise<ToolDecision | null> {
  // Regex fallback luôn sẵn — dùng khi LLM tắt hoặc trả rỗng
  const fallback = regexFallback(userText);

  if (!ollamaEnabled) return fallback;

  const url = `${config.ollamaHost}/api/chat`;
  const body = {
    model: config.ollamaModel,
    messages: [
      { role: 'system', content: SYSTEM + '\n' + contextLines.join('\n') },
      { role: 'user', content: userText.slice(0, 2000) },
    ],
    stream: false,
    format: 'json',
    options: { temperature: 0.1, num_predict: 300 },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      return fallback;
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const raw = data.message?.content?.trim() ?? '';
    if (!raw) return fallback;

    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return fallback; }

    return extractToolFromJson(parsed) ?? fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
