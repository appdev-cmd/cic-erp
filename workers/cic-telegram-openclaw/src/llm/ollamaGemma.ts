import { config, ollamaEnabled } from '../config.js';

const SYSTEM = `Bạn là trợ lý ERP CIC qua Telegram. Trả lời CHỈ bằng một JSON hợp lệ (không markdown, không giải thích).
Các tool được phép:
- {"tool":"help","args":{}}
- {"tool":"list_contracts","args":{"from":null,"to":null}} — from/to là chuỗi ISO YYYY-MM-DD hoặc null để không lọc
Quy tắc: nếu người dùng chào, hỏi cách dùng, hoặc "help" → help. Nếu hỏi hợp đồng, báo cáo, danh sách hợp đồng → list_contracts và cố gắng suy ra from/to từ ngữ cảnh; nếu không rõ thì để null.`;

export type ToolDecision = { tool: 'help' | 'list_contracts'; args: Record<string, unknown> };

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
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama HTTP ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const raw = data.message?.content?.trim() ?? '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as { tool?: string; args?: unknown };
  if (o.tool === 'help') return { tool: 'help', args: {} };
  if (o.tool === 'list_contracts') {
    const a = (o.args && typeof o.args === 'object' ? o.args : {}) as Record<string, unknown>;
    return {
      tool: 'list_contracts',
      args: {
        from: a.from === null || a.from === undefined ? null : String(a.from),
        to: a.to === null || a.to === undefined ? null : String(a.to),
      },
    };
  }
  return null;
}
