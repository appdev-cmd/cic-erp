import { config, ollamaEnabled } from '../config.js';
import { loadAllSkills, formatSkillsForPrompt, type LoadedSkill } from '../skills/skillLoader.js';

const YEAR = new Date().getFullYear();

const BASE_SYSTEM = `Bạn là Trợ lý CIC — OpenClaw-compatible AI assistant chạy local trên máy chủ công ty CIC. Trả lời CHỈ bằng 1 JSON {"tool":"...","args":{...}}.

Core Tools:
natural_chat() — câu chung chung, hỏi "bạn làm được gì", tư vấn, giải thích (không cần tra DB). Ưu tiên khi hội thoại tự nhiên.
chat(message) — câu chào ngắn; message là nội dung cố định tiếng Việt
help() — gửi hướng dẫn đầy đủ (/help)
dashboard() — tổng quan công ty
list_contracts(from,to) — danh sách HĐ
search_contracts(keyword) — tìm HĐ
overdue_payments() — thanh toán quá hạn
expiring_contracts(days) — HĐ sắp hết hạn
my_tasks() — task được giao
revenue_report(year) — doanh thu theo tháng
export_xlsx(from,to) — CHỈ xuất Excel danh sách/báo cáo HỢP ĐỒNG
export_docx(from,to) — CHỈ xuất Word báo cáo HỢP ĐỒNG (không dùng cho đơn xin nghỉ, công văn cá nhân)
leave_docx(from,to,days,reason) — đơn xin nghỉ phép Word (mẫu, điền tên user); from/to/days/reason có thể null
run_shell(command) — chạy lệnh terminal
list_files(path) — xem danh sách file
read_file(path) — đọc nội dung file
write_file(path,content) — tạo/ghi file
save_report(from,to,format) — lưu báo cáo HĐ (format: xlsx|docx)
clear_memory() — xóa lịch sử hội thoại
run_skill(skill,args) — chạy một OpenClaw skill đã cài

Quy tắc QUAN TRỌNG:
- "đơn xin nghỉ"/"nghỉ phép" + file word/docx → leave_docx (KHÔNG export_docx)
- export_docx/export_xlsx CHỈ khi nói về hợp đồng, danh sách HĐ, báo cáo kinh doanh/hợp đồng, xuất excel hợp đồng
- "bạn có thể làm gì"/"làm được gì"/"chức năng" → natural_chat hoặc help
- "báo cáo"/"xuất" + docx + ngữ cảnh HĐ/kinh doanh/quý → export_docx
- "lưu báo cáo" (HĐ) → save_report
- "chạy lệnh"/terminal → run_shell
- doanh thu/kinh doanh → revenue_report
- quá hạn/nợ → overdue_payments
- hết hạn HĐ → expiring_contracts
- task/việc → my_tasks
- tìm + keyword → search_contracts
- tổng quan/tình hình công ty → dashboard
- Chào hỏi đơn giản → chat
- Năm ${YEAR}. Q1=01-01→03-31, Q2=04-01→06-30, Q3=07-01→09-30, Q4=10-01→12-31

Ví dụ:
"tạo đơn xin nghỉ phép file docx" → {"tool":"leave_docx","args":{}}
"lập báo cáo hợp đồng quý 1 docx" → {"tool":"export_docx","args":{"from":"${YEAR}-01-01","to":"${YEAR}-03-31"}}
"bạn có thể làm được gì" → {"tool":"natural_chat","args":{}}
"doanh thu quý 1" → {"tool":"revenue_report","args":{"year":${YEAR}}}
"xin chào" → {"tool":"chat","args":{"message":"Xin chào! Tôi là Trợ lý CIC."}}
"chạy lệnh df -h" → {"tool":"run_shell","args":{"command":"df -h"}}`;

export type ToolName =
  | 'natural_chat' | 'chat' | 'help' | 'dashboard' | 'list_contracts' | 'search_contracts'
  | 'overdue_payments' | 'expiring_contracts' | 'my_tasks' | 'revenue_report'
  | 'export_xlsx' | 'export_docx' | 'leave_docx'
  | 'run_shell' | 'list_files' | 'read_file' | 'write_file' | 'save_report' | 'clear_memory'
  | 'run_skill';

export type ToolDecision = { tool: ToolName; args: Record<string, unknown> };

const VALID_TOOLS: ToolName[] = [
  'natural_chat','chat','help','dashboard','list_contracts','search_contracts',
  'overdue_payments','expiring_contracts','my_tasks','revenue_report',
  'export_xlsx','export_docx','leave_docx',
  'run_shell','list_files','read_file','write_file','save_report','clear_memory',
  'run_skill',
];

let cachedSkills: LoadedSkill[] | null = null;
let skillsLoadedAt = 0;
const SKILL_CACHE_MS = 5 * 60_000;

export function getLoadedSkills(): LoadedSkill[] {
  const now = Date.now();
  if (!cachedSkills || now - skillsLoadedAt > SKILL_CACHE_MS) {
    cachedSkills = loadAllSkills();
    skillsLoadedAt = now;
  }
  return cachedSkills;
}

export function reloadSkills(): LoadedSkill[] {
  cachedSkills = null;
  skillsLoadedAt = 0;
  return getLoadedSkills();
}

function buildSystemPrompt(): string {
  const skills = getLoadedSkills();
  const skillsXml = formatSkillsForPrompt(skills);
  if (!skillsXml) return BASE_SYSTEM;
  return BASE_SYSTEM + '\n\n' + skillsXml + '\n\nKhi user yêu cầu khớp với skill đã cài, dùng: {"tool":"run_skill","args":{"skill":"tên_skill",...args khác}}';
}

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

  const isLeave =
    /ngh[ỉi]\s*ph[ée]p|xin\s*ngh[ỉi]|đơn\s*xin\s*ngh[ỉi]|gi[ấa]y\s*xin\s*ngh[ỉi]|ph[ée]p\s*n[ăa]m/i.test(
      t
    );
  const isContractExport =
    /h[ợo]p\s*[đd][ồo]ng|danh\s*s[áa]ch\s*h[ợo]p|b[áa]o\s*c[áa]o.*(h[ợo]p\s*[đd]|kinh\s*doanh|doanh\s*thu)|xu[ấa]t.*h[ợo]p|l[ậa]p\s*b[áa]o\s*c[áa]o/i.test(
      t
    ) || /qu[ýy]\s*\d/.test(t);

  // Câu hỏi meta → trả lời tự nhiên (giống OpenClaw) hoặc help
  if (
    /b[ạa]n\s+c[óo]\s+th[ểể]|l[àa]m\s+được\s+g[ìi]|ch[ứu]c\s+n[ăa]ng|kh[ảa]\s+n[ăa]ng|gi[úu]p\s+g[ìi]|h[ỗo]\s+tr[ợo]\s+g[ìi]|b[ạa]n\s+l[àa]\s+ai|b[ạa]n\s+l[àa]\s+g[ìi]/i.test(
      text
    )
  ) {
    return { tool: 'natural_chat', args: {} };
  }

  if (
    isLeave &&
    /(docx|word|file\s*word|t[ạa]o|so[ạa]n|l[ậa]p|xu[ấa]t)/i.test(t)
  ) {
    return { tool: 'leave_docx', args: {} };
  }

  if (
    (/xu[ấa]t\s*.*docx|b[áa]o\s*c[áa]o.*docx/i.test(t) || /\bdocx\b|\bword\b/i.test(t)) &&
    isContractExport &&
    !isLeave
  ) {
    return { tool: 'export_docx', args: { from: qFrom, to: qTo } };
  }
  if (
    (/xu[ấa]t\s*.*xlsx|b[áa]o\s*c[áa]o.*xlsx|b[áa]o\s*c[áa]o.*excel/i.test(t) || /\bxlsx\b|\bexcel\b/i.test(t)) &&
    (isContractExport || /h[ợo]p\s*[đd]/i.test(t)) &&
    !isLeave
  ) {
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
  if (/ch[ạa]y\s*l[ệe]nh|terminal|shell/i.test(t)) {
    const cmd = t.replace(/.*(?:ch[ạa]y\s*l[ệe]nh|terminal|shell)\s*/i, '').trim();
    if (cmd) return { tool: 'run_shell', args: { command: cmd } };
  }
  if (/xem\s*file|danh\s*s[áa]ch\s*file|list\s*file|ls\b/i.test(t)) {
    const p = t.replace(/.*(?:xem\s*file|danh\s*s[áa]ch\s*file|list\s*file|ls)\s*/i, '').trim();
    return { tool: 'list_files', args: { path: p || '.' } };
  }
  if (/[đd][ọo]c\s*file|read\s*file|cat\b/i.test(t)) {
    const p = t.replace(/.*(?:[đd][ọo]c\s*file|read\s*file|cat)\s*/i, '').trim();
    if (p) return { tool: 'read_file', args: { path: p } };
  }
  if (/l[ưu]u\s*b[áa]o\s*c[áa]o|save\s*report/i.test(t)) {
    const fmt = /xlsx|excel/i.test(t) ? 'xlsx' : 'docx';
    return { tool: 'save_report', args: { from: qFrom, to: qTo, format: fmt } };
  }
  if (/x[óo]a\s*(l[ịi]ch\s*s[ửu]|memory|h[ộo]i\s*tho[ạa]i)|clear/i.test(t)) {
    return { tool: 'clear_memory', args: {} };
  }
  if (/xin\s*ch[àa]o|hello|hi\b|ch[àa]o|alo/i.test(t)) {
    return { tool: 'chat', args: { message: 'Xin chào! Tôi là Trợ lý CIC — AI chạy local trên máy của bạn. Gõ /help để xem hướng dẫn!' } };
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

  const systemPrompt = buildSystemPrompt();
  const url = `${config.ollamaHost}/api/chat`;
  const body = {
    model: config.ollamaModel,
    messages: [
      { role: 'system', content: systemPrompt + '\n' + contextLines.join('\n') },
      { role: 'user', content: userText.slice(0, 2000) },
    ],
    stream: false,
    format: 'json',
    options: { temperature: 0.15, num_predict: 400 },
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
