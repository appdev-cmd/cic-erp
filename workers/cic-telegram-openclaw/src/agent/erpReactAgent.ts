import { config, ollamaEnabled } from '../config.js';
import type { ResolvedContext } from '../supabaseClient.js';
import { executeErpTool, isValidAgentTool } from './erpToolsExecutor.js';
import { generateNaturalReply } from '../llm/naturalChat.js';

export type ChatMsg = 
  | { role: 'system' | 'user' | 'assistant'; content: string; tool_calls?: any[] }
  | { role: 'tool'; content: string; name?: string };

const YEAR = new Date().getFullYear();

const AGENT_SYSTEM = `Bạn là OpenClaw Agent trên Telegram — một chuyên viên trợ lý của CIC ERP. Bạn có quyền gọi các tool (functions) để truy xuất dữ liệu từ Database hoặc thao tác với file.

NGUYÊN TẮC QUAN TRỌNG:
1. Bạn phải TỰ ĐỘNG suy luận. Đừng ngại gọi nhiều tool liên tiếp nhau nếu cần. Ví dụ: gọi 'overdue_payments' xong, sau đó gọi 'export_xlsx' theo yêu cầu.
2. Dữ liệu CHỈ LẤY từ output của tool, tuyệt đối KHÔNG MÀ ĐỊA ra dữ liệu giả, tên khách hàng giả hay số tiền giả.
3. Nếu người dùng chỉ nói chuyện phím, chào hỏi, hãy trả lời tự nhiên.
4. QUAN TRỌNG VỀ THỜI GIAN: Năm hiện tại là ${YEAR}. Quý 1 = ${YEAR}-01-01 -> ${YEAR}-03-31, Quý 2 = ${YEAR}-04-01 -> ${YEAR}-06-30, Quý 3 = ${YEAR}-07-01 -> ${YEAR}-09-30, Quý 4 = ${YEAR}-10-01 -> ${YEAR}-12-31. Khi người dùng hỏi "tháng X" hoặc "quý Y", BẮT BUỘC phải tư duy và quy đổi ra định dạng YYYY-MM-DD để truyền vào tham số "from" và "to". Tuyệt đối không để trống tham số khi người dùng có nói mốc thời gian. (Ví dụ: Tháng 4 năm nay -> from: "${YEAR}-04-01", to: "${YEAR}-04-30").
5. export_docx / export_xlsx CHỈ DÀNH CHO BÁO CÁO HỢP ĐỒNG. Đơn xin nghỉ phép → dùng tool 'leave_docx' riêng.

Hãy phản hồi người dùng bằng Tiếng Việt một cách chuyên nghiệp, thân thiện. Nếu có file đính kèm trong nội dung input của User, hãy đọc nội dung file đó trước khi trả lời.`;

const NATIVE_TOOLS_SCHEMA = [
  { type: 'function', function: { name: 'dashboard', description: 'Xem tổng quan công ty: số lượng hợp đồng, tổng giá trị, nợ...', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'list_contracts', description: 'Xem danh sách hợp đồng', parameters: { type: 'object', properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } } } } },
  { type: 'function', function: { name: 'search_contracts', description: 'Tìm hợp đồng theo từ khoá', parameters: { type: 'object', properties: { keyword: { type: 'string' } }, required: ['keyword'] } } },
  { type: 'function', function: { name: 'overdue_payments', description: 'Kiểm tra danh sách thanh toán trễ hạn, công nợ', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'expiring_contracts', description: 'Kiểm tra hợp đồng sắp hết hạn', parameters: { type: 'object', properties: { days: { type: 'number', description: 'Số ngày tới' } } } } },
  { type: 'function', function: { name: 'my_tasks', description: 'Xem danh sách task của người dùng hiện tại', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'revenue_report', description: 'Xem báo cáo doanh thu theo tháng / năm / quý', parameters: { type: 'object', properties: { year: { type: 'number' }, quarter: { type: 'number', description: 'Từ 1 đến 4' } } } } },
  { type: 'function', function: { name: 'export_xlsx', description: 'Trích xuất và gửi file Excel (danh sách Hợp Đồng)', parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } } } },
  { type: 'function', function: { name: 'export_docx', description: 'Trích xuất và gửi file Word (báo cáo Hợp Đồng)', parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } } } } },
  { type: 'function', function: { name: 'leave_docx', description: 'Tạo đơn xin nghỉ phép định dạng Word', parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, reason: { type: 'string' }, days: { type: 'number' } } } } },
  { type: 'function', function: { name: 'save_report', description: 'Lưu báo cáo hợp đồng vào local disk (không gửi Telegram trực tiếp)', parameters: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, format: { type: 'string', enum: ['xlsx', 'docx'] } } } } },
  { type: 'function', function: { name: 'run_shell', description: 'Chạy một lệnh hệ thống terminal', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'list_files', description: 'Liệt kê các file trong hệ thống', parameters: { type: 'object', properties: { path: { type: 'string' } } } } },
  { type: 'function', function: { name: 'read_file', description: 'Đọc nội dung một file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'clear_memory', description: 'Xoá lịch sử hội thoại của Agent', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'help', description: 'Gửi danh sách hướng dẫn, cú pháp lệnh chung', parameters: { type: 'object', properties: {} } } }
];

async function ollamaToolCallingTurn(messages: ChatMsg[]): Promise<{ message?: string; tool_calls?: any[] }> {
  const isVllm = config.ollamaHost.includes('/v1');
  const url = isVllm ? `${config.ollamaHost}/chat/completions` : `${config.ollamaHost}/api/chat`;
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
        tools: NATIVE_TOOLS_SCHEMA,
        temperature: 0.15, // Cho vLLM / OpenAI
        max_tokens: 1000,
        options: { temperature: 0.15, num_predict: 1000 }, // Cho Ollama cũ
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
        console.error("Lỗi API:", await res.text());
        return {};
    }
    const data = await res.json() as any;
    
    // Nếu là format OpenAI (vLLM)
    if (data.choices && data.choices[0]) {
      return {
        message: data.choices[0].message?.content?.trim() || undefined,
        tool_calls: data.choices[0].message?.tool_calls
      };
    }
    
    // Nếu là format Ollama
    return {
      message: data.message?.content?.trim() || undefined,
      tool_calls: data.message?.tool_calls
    };
  } catch (err) {
    console.error("Lỗi gọi Ollama API:", err);
    return {};
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

  const maxSteps = 8; // Tăng số bước tối đa cho Multi-step reasoning
  const messages: ChatMsg[] = [
    { role: 'system', content: AGENT_SYSTEM + '\n\n' + params.ctxLines.join('\n') },
    { role: 'user', content: params.userText.slice(0, 5000) },
  ];

  const usedTools: string[] = [];
  let steps = 0;

  for (let i = 0; i < maxSteps; i++) {
    steps++;
    const turn = await ollamaToolCallingTurn(messages);
    
    // Lưu lại message phản hồi từ trợ lý
    if (turn.message || (turn.tool_calls && turn.tool_calls.length > 0)) {
      messages.push({
        role: 'assistant',
        content: turn.message || '',
        tool_calls: turn.tool_calls
      });
    }

    // Nếu không màng gọi tool, Agent đã trả lời xong!
    if (!turn.tool_calls || turn.tool_calls.length === 0) {
      if (turn.message) {
        return { reply: turn.message, steps, usedTools };
      }
      break;
    }

    // Xử lý song song tất cả các tool calls (nếu mô hình gọi nhiều hàm 1 lúc)
    for (const tc of turn.tool_calls) {
      const functionName = tc.function.name;
      let args = {};
      try {
        args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      } catch { }

      const guarded = guardLeaveInsteadOfContractExport(params.userText, functionName, args);
      let output = '';

      if (!isValidAgentTool(guarded.tool)) {
        output = `Lỗi: Tool ${guarded.tool} không tồn tại. Yêu cầu LLM không dùng tool giả mạo.`;
      } else {
        usedTools.push(guarded.tool);
        try {
          const result = await executeErpTool(params.chatId, params.ctx, guarded.tool, guarded.args);
          output = result;
        } catch (err: unknown) {
          output = `Lỗi hệ thống khi gọi tool: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      // Trả output về cho model đắp lại
      messages.push({
        role: 'tool',
        name: functionName,
        content: output.slice(0, 10000) // Tránh context window overflow
      });
    }
  }

  // Fallback nếu chạy quá max steps hoặc model ko nhả tin tự nhiên
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
     return { reply: lastMsg.content, steps, usedTools };
  }

  const fallback = await generateNaturalReply(
    `${params.userText}\n\n(Lưu ý hệ thống: Bạn đã gọi các tool: ${usedTools.join(', ')}. Hãy tổng hợp kết quả để báo cho người dùng)`,
    params.ctxLines
  );
  if (fallback) {
    return { reply: fallback, steps, usedTools };
  }
  return null;
}
