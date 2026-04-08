import { config, ollamaEnabled } from '../config.js';

const NATURAL_SYSTEM = `Bạn là Trợ lý CIC — trợ lý nội bộ công ty, chạy local (Ollama). Trả lời bằng tiếng Việt, tự nhiên, thân thiện, súc tích (khoảng 3–8 câu trừ khi user cần chi tiết).

Bạn có thể giúp: tổng quan ERP (hợp đồng, doanh thu, công nợ, task), xuất Excel/Word báo cáo hợp đồng, tìm hợp đồng, soạn đơn/giấy tờ mẫu, chạy lệnh trên máy (nếu được phép), đọc/ghi file local.

Không bịa số liệu ERP: nếu cần số cụ thể, hãy bảo user hỏi rõ (ví dụ "tổng quan công ty", "doanh thu năm nay").

Không dùng JSON. Chỉ văn bản thuần.`;

export async function generateNaturalReply(
  userText: string,
  contextLines: string[]
): Promise<string | null> {
  if (!ollamaEnabled) return null;

  const url = `${config.ollamaHost}/api/chat`;
  const body = {
    model: config.ollamaModel,
    messages: [
      { role: 'system', content: NATURAL_SYSTEM + '\n\n' + contextLines.join('\n') },
      { role: 'user', content: userText.slice(0, 2000) },
    ],
    stream: false,
    options: { temperature: 0.65, num_predict: 512 },
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
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const raw = data.message?.content?.trim() ?? '';
    return raw || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
