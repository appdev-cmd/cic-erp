// @ts-nocheck
import { callAgentTurn } from '../gateway';
import { streamChat } from '../gateway';
import { extractMentionContextFromText } from '../../mentionService';
import type { ChatRequest, ChatMessage } from '../types';
import type { DepartmentAgent, OpenClawTool, ReactAgentResult, ReActState, UserContext } from './types';

export const OPENCLAW_SYSTEM_PROMPT_PREFIX = `Bạn là OpenClaw Agent, một chuyên viên AI thông minh của dự án CIC ERP.
Nhiệm vụ chính: tiếp nhận yêu cầu từ người dùng, sử dụng công cụ (tools) để truy xuất dữ liệu ERP khi CẦN THIẾT, sau đó phân tích và trả lời.

NGUYÊN TẮC BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):
1. KHI ĐƯỢC HỎI CÁC CÂU LIÊN QUAN ĐẾN DOANH THU, BÁO CÁO, TÌNH HÌNH KINH DOANH, SỐ LIỆU: BẠN [PHẢI GỌI TOOL] MỚI ĐƯỢC LẤY SỐ LIỆU. KHÔNG BAO GIỜ được tự ý sinh số liệu!
2. KHI ĐƯỢC HỎI CÂU HỎI CHUNG (tư vấn, kiến thức, trò chuyện): TRẢ LỜI TỰ NHIÊN, KHÔNG CẦN GỌI TOOL. KHÔNG từ chối trả lời.
3. CHÚ Ý THỜI GIAN: Hôm nay là ${new Date().toISOString().slice(0, 10)}. Khi user hỏi về "hôm nay", "tháng này", "quý này" → phải chuyển thành dateFrom/dateTo cụ thể.
4. Bạn có thể gọi nhiều công cụ liên tiếp (multi-step reasoning).
5. CỰC KỲ QUAN TRỌNG: Kết quả từ công cụ đã được format sẵn. Hãy COPY NGUYÊN VĂN con số đó. KHÔNG làm tròn.
6. BẮT BUỘC TRẢ LỜI 100% BẰNG TIẾNG VIỆT. KHÔNG DÙNG TIẾNG TRUNG (亿, 万). CHÉP NGUYÊN XI SỐ TỪ TOOL.
7. CỰC KỲ QUAN TRỌNG: KHI TOOL TRẢ VỀ BẢNG MARKDOWN hoặc KHỐI \`\`\`chart\`\`\`... BẠN BẮT BUỘC PHẢI CHÉP LẠI TOÀN BỘ Y NGUYÊN VĂN VÀO CÂU TRẢ LỜI (KHÔNG ĐƯỢC BỎ SÓT BẤT CỨ DÒNG NÀO CỦA BIỂU ĐỒ HOẶC BẢNG).
8. TUYỆT ĐỐI KHÔNG SỬ DỤNG CÁC THẺ HTML TRONG CÂU TRẢ LỜI (Ví dụ: <span>, <font>, <div>). CHỈ DÙNG MARKDOWN THUẦN TÚY! Lỗi thẻ <span> sẽ làm hỏng UI.
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

  const { cleanText, contextString } = extractMentionContextFromText(userText);
  const finalUserText = contextString ? cleanText + '\n' + contextString : cleanText;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...messageHistory,
    { role: 'user', content: finalUserText }
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
        // Timeout + Retry: mỗi tool có tối đa 15s, retry 1 lần nếu lỗi
        const executeWithTimeout = (t: OpenClawTool, a: any, ctx: UserContext, timeoutMs = 15000): Promise<string | object> => {
          return Promise.race([
            t.execute(a, ctx),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Tool timeout (15s)')), timeoutMs))
          ]);
        };

        let attempts = 0;
        const maxRetries = 1;
        while (attempts <= maxRetries) {
          try {
            const result = await executeWithTimeout(tool, args, userContext);
            outputStr = typeof result === 'object' ? JSON.stringify(result) : result;
            break;
          } catch (err: any) {
            attempts++;
            if (attempts > maxRetries) {
              outputStr = `Lỗi hệ thống khi chạy tool ${fnName}: ${err.message || String(err)}`;
              console.error(`[OpenClaw] Tool ${fnName} failed after ${attempts} attempts:`, err.message);
            } else {
              console.warn(`[OpenClaw] Tool ${fnName} failed, retrying (${attempts}/${maxRetries})...`);
            }
          }
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
