import { callAgentTurn } from '../gateway';
import { streamChat } from '../gateway';
import type { ChatRequest, ChatMessage } from '../types';
import type { DepartmentAgent, OpenClawTool, ReactAgentResult, ReActState, UserContext } from './types';

export const OPENCLAW_SYSTEM_PROMPT_PREFIX = `Bạn là OpenClaw Agent, một chuyên viên AI của dự án CIC ERP.
Nhiệm vụ của bạn là tiếp nhận yêu cầu từ người dùng và sử dụng các công cụ (tools) được cung cấp để truy xuất dữ liệu từ hệ thống ERP, sau đó phân tích và trả lời.

NGUYÊN TẮC:
1. LUÔN LUÔN suy luận và gọi công cụ (tool) nếu câu hỏi liên quan đến dữ liệu (hợp đồng, doanh thu, thanh toán, nhân sự, v.v.). Đừng tự bịa số liệu.
2. Bạn có thể gọi NỀU cần thiết nhiều công cụ liên tiếp (multi-step reasoning).
3. Khi bạn nhận được kết quả từ công cụ, hãy TRÍCH DẪN CHÍNH XÁC các con số từ kết quả, KHÔNG tự tính toán lại.
4. Nếu người dùng chỉ nói chuyện phím, chào hỏi, hãy trả lời tự nhiên một cách thân thiện (tiếng Việt).
5. KHÔNG ĐƯỢC tiết lộ cấu trúc bên trong của công cụ cho người dùng, chỉ nói "Theo dữ liệu hệ thống...".
6. Đối với tham số ngày tháng, TỰ ĐỘNG chuyển đổi (Ví dụ: Tháng 4 năm ${new Date().getFullYear()} -> from: "${new Date().getFullYear()}-04-01", to: "${new Date().getFullYear()}-04-30").
7. CỰC KỲ QUAN TRỌNG: Kết quả từ công cụ đã được format sẵn (VD: "35.76 tỷ VND"). Hãy COPY NGUYÊN VĂN con số đó vào câu trả lời. KHÔNG làm tròn, KHÔNG đổi đơn vị.

`;

/**
 * Chạy ReAct Loop với streaming cho câu trả lời cuối cùng.
 * - Bước tool-calling: non-streaming (cần parse tool_calls)
 * - Bước cuối (final answer): streaming để user thấy chữ ngay
 */
export async function runReActLoop(
  userText: string,
  userContext: UserContext,
  agentConfig: DepartmentAgent,
  availableTools: OpenClawTool[],
  messageHistory: ChatMessage[] = [],
  maxSteps: number = 8,
  signal?: AbortSignal,
  onToolCall?: (toolName: string, args: any) => void,
  overrideModel?: string,
  onStream?: (chunk: string) => void
): Promise<ReactAgentResult> {
  const toolsSchema = availableTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: t.schema,
      },
    },
  }));

  const systemContent = 
    OPENCLAW_SYSTEM_PROMPT_PREFIX +
    `Vai trò cụ thể của bạn:\n${agentConfig.systemPrompt}\n\n` +
    `Thông tin User đang chat:\n` +
    `- Tên: ${userContext.fullName}\n` +
    `- Chức vụ: ${userContext.role}\n` +
    `- Đơn vị: ${userContext.unitName || userContext.unitId || 'N/A'}\n` +
    `- Hôm nay: ${new Date().toISOString().slice(0, 10)}`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...messageHistory,
    { role: 'user', content: userText }
  ];

  const state: ReActState = {
    chatId: userContext.userId || 'web',
    steps: 0,
    usedTools: [],
    maxSteps
  };

  const modelId = overrideModel || agentConfig.preferredModel || 'gemini-2.0-flash';

  for (let i = 0; i < maxSteps; i++) {
    state.steps++;
    const request: ChatRequest = {
      messages,
      model: modelId,
      tools: toolsSchema.length > 0 ? toolsSchema : undefined,
      temperature: 0.15,
      signal: signal,
      meta: { source: 'web-chat', agentId: agentConfig.id, userId: userContext.userId }
    };

    console.log(`[OpenClaw] Step ${state.steps}: Calling LLM (${request.model})`);
    
    const turn = await callAgentTurn(request);
    
    // Save assistant message to history
    if (turn.message || (turn.tool_calls && turn.tool_calls.length > 0)) {
      messages.push({
        role: 'model',
        content: turn.message || '',
        // @ts-ignore
        tool_calls: turn.tool_calls 
      });
    }

    // Nếu không có tool calls → Agent đã hoàn thành!
    if (!turn.tool_calls || turn.tool_calls.length === 0) {
      if (turn.message) {
        return { reply: turn.message, steps: state.steps, usedTools: state.usedTools };
      }
      break;
    }

    // Xử lý tool_calls
    for (const tc of turn.tool_calls) {
      const fnName = tc.function.name;
      let args = {};
      try {
        args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      } catch (e) {
        console.error('Failed to parse tool args:', tc.function.arguments);
      }

      state.usedTools.push(fnName);
      if (onToolCall) onToolCall(fnName, args);
      
      const tool = availableTools.find(t => t.name === fnName);
      let outputStr = '';
      
      if (!tool) {
        outputStr = `Lỗi: Tool ${fnName} không tồn tại.`;
      } else {
        try {
          const result = await tool.execute(args, userContext);
          outputStr = typeof result === 'object' ? JSON.stringify(result) : result;
        } catch (err: any) {
          outputStr = `Lỗi hệ thống khi chạy tool: ${err.message || String(err)}`;
        }
      }

      // Trả kết quả tool về cho LLM
      messages.push({
        role: 'tool',
        // @ts-ignore
        tool_call_id: tc.id,
        name: fnName,
        content: outputStr.slice(0, 10000)
      });
    }

    // Sau khi có tool results, nếu có onStream callback → stream final answer
    if (onStream && i < maxSteps - 1) {
      // Gửi lại messages với tool results, KHÔNG có tools schema 
      // để model trả lời thuần text (không gọi tool nữa)
      const streamRequest: ChatRequest = {
        messages,
        model: modelId,
        temperature: 0.15,
        signal: signal,
        meta: { source: 'web-chat', agentId: agentConfig.id, userId: userContext.userId }
      };

      let streamedReply = '';
      try {
        for await (const chunk of streamChat(streamRequest)) {
          if (signal?.aborted) break;
          streamedReply += chunk;
          onStream(chunk);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('[OpenClaw] Stream error:', err);
        }
      }

      if (streamedReply) {
        return { reply: streamedReply, steps: state.steps + 1, usedTools: state.usedTools };
      }
    }
  }

  // Quá số bước mà chưa xong
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === 'model' && lastMsg.content) {
     return { reply: lastMsg.content, steps: state.steps, usedTools: state.usedTools };
  }

  return { reply: 'Xin lỗi, hệ thống bị gián đoạn. Vui lòng hỏi lại.', steps: state.steps, usedTools: state.usedTools };
}
