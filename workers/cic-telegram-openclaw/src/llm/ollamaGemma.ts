import { config, ollamaEnabled } from '../config.js';

const SYSTEM = `Bạn là Trợ lý CIC — trợ lý AI nội bộ của công ty CIC trên Telegram. Bạn luôn trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp.

**Quy tắc:**
1. Nếu người dùng hỏi điều bạn có thể trả lời bằng tool, hãy trả JSON chọn tool phù hợp.
2. Nếu là câu chào, hỏi thăm, hoặc câu hỏi chung — trả JSON tool "chat" kèm nội dung trả lời.
3. Luôn trả lời CHỈ bằng một JSON hợp lệ (không markdown, không giải thích bên ngoài JSON).

**Tools được phép:**
- {"tool":"chat","args":{"message":"nội dung trả lời tự nhiên"}} — dùng khi chào hỏi, hỏi chung, giải thích
- {"tool":"help","args":{}} — khi hỏi "help", hướng dẫn sử dụng
- {"tool":"dashboard","args":{}} — tổng quan: số HĐ, doanh thu, công nợ, task
- {"tool":"list_contracts","args":{"from":null,"to":null}} — danh sách hợp đồng (from/to ISO hoặc null)
- {"tool":"search_contracts","args":{"keyword":"..."}} — tìm hợp đồng theo tên, mã, khách hàng
- {"tool":"overdue_payments","args":{}} — thanh toán quá hạn
- {"tool":"expiring_contracts","args":{"days":30}} — HĐ sắp hết hạn (mặc định 30 ngày)
- {"tool":"my_tasks","args":{}} — công việc được giao cho tôi
- {"tool":"revenue_report","args":{"year":null}} — doanh thu theo tháng (null = năm nay)
- {"tool":"export_xlsx","args":{"from":null,"to":null}} — xuất Excel hợp đồng
- {"tool":"export_docx","args":{"from":null,"to":null}} — xuất Word hợp đồng

**Ví dụ:**
- "xin chào" → {"tool":"chat","args":{"message":"Xin chào! Tôi là Trợ lý CIC. Bạn cần tôi giúp gì? Gõ /help để xem danh sách lệnh."}}
- "tình hình công ty thế nào" → {"tool":"dashboard","args":{}}
- "cho xem hợp đồng quý 1" → {"tool":"list_contracts","args":{"from":"2026-01-01","to":"2026-03-31"}}
- "tìm hợp đồng Viettel" → {"tool":"search_contracts","args":{"keyword":"Viettel"}}
- "có khoản nào quá hạn không" → {"tool":"overdue_payments","args":{}}
- "HĐ nào sắp hết hạn" → {"tool":"expiring_contracts","args":{"days":30}}
- "task của tôi" → {"tool":"my_tasks","args":{}}
- "doanh thu năm nay" → {"tool":"revenue_report","args":{"year":null}}
- "xuất excel hợp đồng" → {"tool":"export_xlsx","args":{"from":null,"to":null}}
- Năm hiện tại: ${new Date().getFullYear()}. Quý 1 = 01-01→03-31, Q2 = 04-01→06-30, Q3 = 07-01→09-30, Q4 = 10-01→12-31.`;

export type ToolName =
  | 'chat' | 'help' | 'dashboard' | 'list_contracts' | 'search_contracts'
  | 'overdue_payments' | 'expiring_contracts' | 'my_tasks' | 'revenue_report'
  | 'export_xlsx' | 'export_docx';

export type ToolDecision = { tool: ToolName; args: Record<string, unknown> };

export async function decideTool(
  userText: string,
  contextLines: string[]
): Promise<ToolDecision | null> {
  if (!ollamaEnabled) return null;

  const url = `${config.ollamaHost}/api/chat`;
  const body = {
    model: config.ollamaModel,
    messages: [
      { role: 'system', content: SYSTEM + '\n' + contextLines.join('\n') },
      { role: 'user', content: userText.slice(0, 2000) },
    ],
    stream: false,
    format: 'json',
    options: { temperature: 0.3, num_predict: 512 },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${t.slice(0, 200)}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const raw = data.message?.content?.trim() ?? '{}';
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return null; }

    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as { tool?: string; args?: unknown };
    const validTools: ToolName[] = [
      'chat','help','dashboard','list_contracts','search_contracts',
      'overdue_payments','expiring_contracts','my_tasks','revenue_report',
      'export_xlsx','export_docx',
    ];
    if (!o.tool || !validTools.includes(o.tool as ToolName)) return null;
    const args = (o.args && typeof o.args === 'object' ? o.args : {}) as Record<string, unknown>;
    return { tool: o.tool as ToolName, args };
  } finally {
    clearTimeout(timeout);
  }
}
