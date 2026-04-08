/**
 * Agent ReAct kiểu OpenClaw: nhiều bước suy luận → gọi tool ERP/local → tổng hợp câu trả lời tự nhiên.
 */
import { config, ollamaEnabled } from '../config.js';
import type { ResolvedContext } from '../supabaseClient.js';
import { executeErpTool, isValidAgentTool } from './erpToolsExecutor.js';
import { generateNaturalReply } from '../llm/naturalChat.js';

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

const YEAR = new Date().getFullYear();

const AGENT_SYSTEM = `Bạn là agent OpenClaw trên Telegram — trợ lý thông minh cho CIC ERP.
Bạn có quyền gọi tool truy vấn database ERP (Supabase RPC) và thao tác file/máy local.

MỖI lượt chỉ trả về MỘT object JSON hợp lệ (không markdown, không text ngoài JSON):

1) Gọi tool:
{"thought":"1 câu suy nghĩ ngắn","action":"tool","tool":"TÊN_TOOL","args":{}}

2) Trả lời xong cho user (tiếng Việt tự nhiên, có thể nhiều đoạn, emoji vừa phải):
{"thought":"...","action":"answer","message":"nội dung gửi user"}

Quy tắc:
- CHỈ dùng số liệu từ kết quả tool; không bịa dữ liệu ERP.
- Nếu user hỏi chung ("bạn làm được gì"), có thể gọi tool "help" rồi answer.
- export_docx / export_xlsx chỉ cho BÁO CÁO HỢP ĐỒNG. Đơn xin nghỉ phép → tool "leave_docx".
- from/to ngày dạng YYYY-MM-DD hoặc null. Quý: Q1=${YEAR}-01-01..03-31, Q2=04-01..06-30, Q3=07-01..09-30, Q4=10-01..12-31.
- Có thể gọi nhiều tool liên tiếp (dashboard rồi overdue_payments...) trước khi answer.

Danh sách tool (args):
- dashboard — {}
- list_contracts — {from,to} optional
- search_contracts — {keyword}
- overdue_payments — {}
- expiring_contracts — {days} default 30
- my_tasks — {}
- revenue_report — {year} optional
- export_xlsx, export_docx — {from,to} optional
- leave_docx — {from,to,days,reason} optional
- save_report — {from,to,format} format xlsx|docx
- run_shell — {command}
- list_files — {path}
- read_file — {path}
- write_file — {path,content}
- clear_memory — {}
- help — {}`;

type Step =
  | { type: 'answer'; message: string }
  | { type: 'tool'; tool: string; args: Record<string, unknown> };

function parseStep(raw: string): Step | null {
  const trimmed = raw.trim();
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      o = JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (Array.isArray(o.tool_calls) && o.tool_calls.length > 0) {
    const tc = o.tool_calls[0] as Record<string, unknown>;
    const fn = tc.function as Record<string, unknown> | undefined;
    if (fn && typeof fn.name === 'string') {
      let args: Record<string, unknown> = {};
      if (typeof fn.arguments === 'string') {
        try {
          args = JSON.parse(fn.arguments) as Record<string, unknown>;
        } catch { /* ignore */ }
      }
      return { type: 'tool', tool: fn.name, args };
    }
    o = { ...o, ...(tc as Record<string, unknown>) };
  }

  const action = String(o.action ?? '').toLowerCase();
  if (action === 'answer' && typeof o.message === 'string' && o.message.trim()) {
    return { type: 'answer', message: o.message.trim() };
  }
  if (action === 'tool' && typeof o.tool === 'string') {
    const args =
      o.args && typeof o.args === 'object' && !Array.isArray(o.args)
        ? (o.args as Record<string, unknown>)
        : {};
    return { type: 'tool', tool: o.tool.trim(), args };
  }
  return null;
}

async function ollamaJsonTurn(messages: ChatMsg[]): Promise<string> {
  const url = `${config.ollamaHost}/api/chat`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        messages,
        stream: false,
        format: 'json',
        options: { temperature: 0.25, num_predict: 700 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

function guardLeaveInsteadOfContractExport(
  userText: string,
  tool: string,
  args: Record<string, unknown>
): { tool: string; args: Record<string, unknown> } {
  if (
    (tool === 'export_docx' || tool === 'export_xlsx') &&
    /ngh[ỉi]\s*ph[ée]p|xin\s*ngh[ỉi]|đơn\s*xin\s*ngh[ỉi]|gi[ấa]y\s*xin\s*ngh[ỉi]/i.test(userText)
  ) {
    return { tool: 'leave_docx', args: {} };
  }
  return { tool, args };
}

export type ReactAgentResult = {
  reply: string;
  steps: number;
  usedTools: string[];
};

export async function runErpReactAgent(params: {
  chatId: number;
  userText: string;
  ctx: ResolvedContext;
  ctxLines: string[];
}): Promise<ReactAgentResult | null> {
  if (!ollamaEnabled) return null;

  const maxSteps = config.reactMaxSteps;
  const messages: ChatMsg[] = [
    { role: 'system', content: AGENT_SYSTEM + '\n\n' + params.ctxLines.join('\n') },
    { role: 'user', content: params.userText.slice(0, 3500) },
  ];

  const usedTools: string[] = [];
  let steps = 0;

  for (let i = 0; i < maxSteps; i++) {
    steps++;
    const raw = await ollamaJsonTurn(messages);
    if (!raw) break;

    const step = parseStep(raw);
    if (!step) {
      messages.push({ role: 'assistant', content: raw.slice(0, 2000) });
      messages.push({
        role: 'user',
        content:
          'Phản hồi trước không phải JSON hợp lệ. Trả về CHỈ một JSON: {"action":"tool","tool":"...","args":{}} hoặc {"action":"answer","message":"..."}',
      });
      continue;
    }

    if (step.type === 'answer') {
      return { reply: step.message.slice(0, 4090), steps, usedTools };
    }

    messages.push({ role: 'assistant', content: raw.slice(0, 2000) });

    let { tool, args } = guardLeaveInsteadOfContractExport(params.userText, step.tool, step.args);
    if (!isValidAgentTool(tool)) {
      messages.push({
        role: 'user',
        content: `[Lỗi] Tool "${tool}" không tồn tại. Dùng một trong: dashboard, list_contracts, search_contracts, overdue_payments, expiring_contracts, my_tasks, revenue_report, export_xlsx, export_docx, leave_docx, save_report, run_shell, list_files, read_file, write_file, clear_memory, help.`,
      });
      continue;
    }

    usedTools.push(tool);
    const result = await executeErpTool(params.chatId, params.ctx, tool, args);
    messages.push({
      role: 'user',
      content: `[Kết quả tool ${tool}]\n${result.slice(0, 14000)}\n\nNếu đủ dữ liệu → {"action":"answer","message":"..."} bằng tiếng Việt. Nếu cần thêm → gọi tool khác.`,
    });
  }

  const fallback = await generateNaturalReply(
    `${params.userText}\n\n(Lưu ý: agent đã gọi tool: ${usedTools.join(', ') || 'không'} nhưng chưa kết thúc — hãy trả lời tốt nhất có thể.)`,
    params.ctxLines
  );
  if (fallback) {
    return { reply: fallback.slice(0, 4090), steps, usedTools };
  }
  return null;
}
