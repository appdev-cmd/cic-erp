import { callAgentTurn } from '../gateway';
export const OPENCLAW_SYSTEM_PROMPT_PREFIX = `Bạn là OpenClaw Agent, một chuyên viên AI của dự án CIC ERP.
Nhiệm vụ của bạn là tiếp nhận yêu cầu từ người dùng và sử dụng các công cụ (tools) được cung cấp để truy xuất dữ liệu từ hệ thống ERP, sau đó phân tích và trả lời.

NGUYÊN TẮC:
1. LUÔN LUÔN suy luận và gọi công cụ (tool) nếu câu hỏi liên quan đến dữ liệu (hợp đồng, doanh thu, thanh toán, nhân sự, v.v.). Đừng tự bịa số liệu.
2. Bạn có thể gọi NỀU cần thiết nhiều công cụ liên tiếp (multi-step reasoning). Ví dụ: tìm hợp đồng trước -> xem chi tiết thanh toán của hợp đồng đó.
3. Khi bạn nhận được kết quả từ công cụ, hãy định dạng và trả lời người dùng một cách chuyên nghiệp, chính xác.
4. Nếu người dùng chỉ nói chuyện phím, chào hỏi, hãy trả lời tự nhiên một cách thân thiện (tiếng Việt).
5. KHÔNG ĐƯỢC tiết lộ cấu trúc bên trong của công cụ cho người dùng, chỉ nói "Theo dữ liệu hệ thống...".
6. Đối với tham số ngày tháng, TỰ ĐỘNG chuyển đổi (Ví dụ: Tháng 4 năm ${new Date().getFullYear()} -> from: "${new Date().getFullYear()}-04-01", to: "${new Date().getFullYear()}-04-30").

`;
export async function runReActLoop(userText, userContext, agentConfig, availableTools, messageHistory = [], maxSteps = 8, signal, onToolCall) {
    const toolsSchema = availableTools.map((t) => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: {
                type: 'object',
                properties: t.schema,
            },
        },
    }));
    const systemContent = OPENCLAW_SYSTEM_PROMPT_PREFIX +
        `Vai trò cụ thể của bạn:\n${agentConfig.systemPrompt}\n\n` +
        `Thông tin User đang chat:\n` +
        `- Tên: ${userContext.fullName}\n` +
        `- Chức vụ: ${userContext.role}\n` +
        `- Đơn vị: ${userContext.unitName || userContext.unitId || 'N/A'}\n` +
        `- Hôm nay: ${new Date().toISOString().slice(0, 10)}`;
    const messages = [
        { role: 'system', content: systemContent },
        ...messageHistory,
        { role: 'user', content: userText }
    ];
    const state = {
        chatId: userContext.userId || 'web',
        steps: 0,
        usedTools: [],
        maxSteps
    };
    for (let i = 0; i < maxSteps; i++) {
        state.steps++;
        const request = {
            messages,
            model: agentConfig.preferredModel || 'gemini-2.0-flash',
            tools: toolsSchema.length > 0 ? toolsSchema : undefined,
            temperature: 0.15,
            signal: signal,
            meta: { source: 'web-chat', agentId: agentConfig.id, userId: userContext.userId }
        };
        console.log(`[OpenClaw] Step ${state.steps}: Calling LLM (${request.model})`);
        const turn = await callAgentTurn(request);
        // Save assistant message to history
        if (turn.message || (turn.tool_calls && turn.tool_calls.length > 0)) {
            // API có thể trả về content rỗng nhưng có tool_calls
            messages.push({
                role: 'model',
                content: turn.message || '',
                // @ts-ignore - ta pass thẳng structure của openai tool_calls
                tool_calls: turn.tool_calls
            });
        }
        // Nếu không có tool calls, Agent đã hoàn thành!
        if (!turn.tool_calls || turn.tool_calls.length === 0) {
            if (turn.message) {
                return { reply: turn.message, steps: state.steps, usedTools: state.usedTools };
            }
            break; // Message rỗng + ko tool calls -> Lỗi hoặc end
        }
        // Xử lý song song các tool_calls
        for (const tc of turn.tool_calls) {
            const fnName = tc.function.name;
            let args = {};
            try {
                args = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            }
            catch (e) {
                console.error('Failed to parse tool args:', tc.function.arguments);
            }
            state.usedTools.push(fnName);
            if (onToolCall)
                onToolCall(fnName, args);
            const tool = availableTools.find(t => t.name === fnName);
            let outputStr = '';
            if (!tool) {
                outputStr = `Lỗi: Tool ${fnName} không tồn tại.`;
            }
            else {
                try {
                    const result = await tool.execute(args, userContext);
                    outputStr = typeof result === 'object' ? JSON.stringify(result) : result;
                }
                catch (err) {
                    outputStr = `Lỗi hệ thống khi chạy tool: ${err.message || String(err)}`;
                }
            }
            // Trả kết quả tool về cho LLM (cần mock role tool nhưng trong history của AI gateway thì role = 'user')
            // Note: Gemini / OpenAI xử lý role tool khác nhau, nhưng cơ bản ta đắp dưới dạng context JSON
            messages.push({
                role: 'user', // Gemini proxy format
                content: `[HỆ THỐNG - KẾT QUẢ CỦA CÔNG CỤ: ${fnName}]\n${outputStr.slice(0, 10000)}`
            });
        }
    }
    // Quá số bước mà chưa xong
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'model' && lastMsg.content) {
        return { reply: lastMsg.content, steps: state.steps, usedTools: state.usedTools };
    }
    return { reply: 'Xin lỗi, hệ thống bị gián đoạn trong lúc xử lý công cụ. Vui lòng hỏi lại với thông tin cụ thể hơn.', steps: state.steps, usedTools: state.usedTools };
}
