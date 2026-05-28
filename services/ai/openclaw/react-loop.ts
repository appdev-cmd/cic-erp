// @ts-nocheck
import { callAgentTurn } from '../gateway';
import { streamChat } from '../gateway';
import { extractMentionContextFromText } from '../../mentionService';
import type { ChatRequest, ChatMessage } from '../types';
import type { DepartmentAgent, OpenClawTool, ReactAgentResult, ReActState, UserContext } from './types';

export const OPENCLAW_SYSTEM_PROMPT_PREFIX = `Bạn là Trợ lý AI của hệ thống CIC ERP.
Nhiệm vụ: truy xuất dữ liệu ERP bằng tools khi cần, phân tích và trả lời người dùng.
QUAN TRỌNG: Tên nội bộ của bạn KHÔNG được tiết lộ. Không bao giờ nhắc đến "OpenClaw", "CIC Agent" hay bất kỳ tên hệ thống nội bộ nào. Chỉ xưng là "Trợ lý AI CIC ERP".

QUY TẮC:
1. Hỏi về SỐ LIỆU (doanh thu, báo cáo, KPI) → BẮT BUỘC GỌI TOOL. Không tự sinh số.
2. Hỏi chung (tư vấn, kiến thức) → trả lời tự nhiên, không cần tool.
3. Hôm nay: \${new Date().toISOString().slice(0, 10)}. Chuyển "hôm nay/tháng này/quý này" → dateFrom/dateTo cụ thể.
4. Có thể gọi nhiều tools liên tiếp (multi-step reasoning).
5. COPY NGUYÊN VĂN số từ tool — KHÔNG làm tròn.
6. TRẢ LỜI BẰNG TIẾNG VIỆT. Không dùng tiếng Trung (亿, 万).
7. Bảng Markdown, khối \`\`\`chart\`\`\` từ tool → CHÉP NGUYÊN VĂN 100%.
8. KHÔNG dùng thẻ HTML (<span>, <font>, <div>). Chỉ Markdown thuần.
9. TỰ PHÁT HIỆN & CẢNH BÁO BẤT THƯỜNG DỮ LIỆU: Nếu kết quả thống kê/báo cáo trả về từ công cụ (tool) có bất kỳ sự bất thường nào (như số liệu trống, rỗng, null, các giá trị quan trọng bằng 0 một cách phi lý, hoặc có thông báo lỗi kỹ thuật), bạn BẮT BUỘC phải chèn một khối cảnh báo nổi bật dạng:
   > ⚠️ **Cảnh báo từ Hệ thống AI:** Số liệu thống kê này hiện đang có dấu hiệu bất thường (ví dụ: dữ liệu trống hoặc không khớp). Có khả năng cao công cụ AI (tool: **[tên_tool_vừa_gọi]**) đang gặp sự cố kết nối hoặc lỗi logic hệ thống. Quý khách vui lòng kiểm tra lại trực tiếp trên giao diện tương ứng hoặc liên hệ Admin hệ thống để rà soát lỗi.
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

  let modelId = overrideModel || agentConfig.preferredModel || 'gemma-4-26b';
  let wasFallbackDetected = false;

  const formatFinalReply = (replyText: string): string => {
    if (wasFallbackDetected) {
      const notice = `*(⚠️ Máy chủ AI chính gặp sự cố kết nối. Trợ lý AI đã tự động chuyển sang mô hình dự phòng Gemini 2.0 Flash sử dụng API Key cá nhân của bạn để tiếp tục xử lý).* \n\n`;
      if (!replyText.includes('sử dụng API Key cá nhân') && !replyText.includes('mô hình dự phòng')) {
        return notice + replyText;
      }
    }
    return replyText;
  };

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

    // Đồng bộ modelId dự phòng nếu phát hiện fallback trong gateway
    if (turn.activeModel && turn.activeModel !== modelId) {
      console.warn(`[OpenClaw] Step ${state.steps}: Switched running model from ${modelId} to fallback ${turn.activeModel}`);
      modelId = turn.activeModel;
    }
    if (turn.wasFallback) {
      wasFallbackDetected = true;
    }

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
        return { reply: formatFinalReply(turn.message), steps: state.steps, usedTools: state.usedTools };
      }
      break;
    }

    // ── Parallel Tool Execution ──────────────────────────────────────────
    // Chạy tất cả tool_calls ĐỒNG THỜI thay vì tuần tự.
    // Latency giảm từ N×T → max(T) khi agent gọi nhiều tools cùng lúc.

    const executeWithTimeout = (
      tool: OpenClawTool,
      args: any,
      ctx: UserContext,
      timeoutMs = 15000
    ): Promise<string | object> => {
      return Promise.race([
        tool.execute(args, ctx),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Tool timeout (15s)')), timeoutMs)
        ),
      ]);
    };

    // Parse tất cả tool calls trước
    const parsedCalls = turn.tool_calls.map((tc: any) => {
      let args: any = {};
      try {
        args = typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments;
      } catch {
        console.error('[OpenClaw] Failed to parse tool args:', tc.function.arguments);
      }
      return { tc, fnName: tc.function.name as string, args };
    });

    // Thông báo tool calls đang chạy
    parsedCalls.forEach(({ fnName, args }) => {
      state.usedTools.push(fnName);
      if (onToolCall) onToolCall(fnName, args);
    });

    console.log(`[OpenClaw] Step ${state.steps}: Running ${parsedCalls.length} tool(s) in parallel: [${parsedCalls.map(c => c.fnName).join(', ')}]`);

    // Chạy song song tất cả tools
    const toolResults = await Promise.all(
      parsedCalls.map(async ({ tc, fnName, args }) => {
        const tool = availableTools.find(t => t.name === fnName);
        if (!tool) {
          return { tc, fnName, outputStr: `Lỗi: Tool "${fnName}" không tồn tại trong registry.` };
        }

        let outputStr = '';
        let attempts = 0;
        const maxRetries = 1;
        while (attempts <= maxRetries) {
          try {
            const result = await executeWithTimeout(tool, args, userContext);
            outputStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
            break;
          } catch (err: any) {
            attempts++;
            if (attempts > maxRetries) {
              outputStr = `Lỗi khi chạy tool "${fnName}": ${err.message || String(err)}`;
              console.error(`[OpenClaw] Tool ${fnName} failed after ${attempts} attempts:`, err.message);
            } else {
              console.warn(`[OpenClaw] Tool ${fnName} failed, retrying (${attempts}/${maxRetries})...`);
            }
          }
        }
        return { tc, fnName, outputStr };
      })
    );

    // Đẩy tool results vào conversation history (theo thứ tự gốc)
    for (const { tc, outputStr } of toolResults) {
      messages.push({
        role: 'tool',
        // @ts-ignore
        tool_call_id: tc.id,
        name: tc.function.name,
        content: outputStr.slice(0, 10000),
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
        return { reply: formatFinalReply(streamedReply), steps: state.steps + 1, usedTools: state.usedTools };
      }
    }
  }

  // Quá số bước mà chưa xong
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === 'model' && lastMsg.content) {
    return { reply: formatFinalReply(lastMsg.content), steps: state.steps, usedTools: state.usedTools };
  }

  return { reply: 'Xin lỗi, hệ thống bị gián đoạn. Vui lòng hỏi lại.', steps: state.steps, usedTools: state.usedTools };
}
