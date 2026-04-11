import { config, ollamaEnabled } from '../config.js';
import type { ResolvedContext } from '../supabaseClient.js';
import { agentDefinitions } from '../../../../services/ai/openclaw/agents/definitions.js';
import { erpToolsRegistry } from '../../../../services/ai/openclaw/tools/registry.js';
import { executeErpTool, isValidAgentTool } from './erpToolsExecutor.js';
import { generateNaturalReply } from '../llm/naturalChat.js';

export type ChatMsg = 
  | { role: 'system' | 'user' | 'assistant'; content: string; tool_calls?: any[] }
  | { role: 'tool'; content: string; name?: string };

const YEAR = new Date().getFullYear();

// Đồng bộ 100% System Prompt từ Web Trợ lý Ban Giám Đốc
const AGENT_SYSTEM = agentDefinitions['BGD'].systemPrompt;

const webAllowedTools = new Set(agentDefinitions['BGD'].allowedTools);

// Tự động map schema từ Zod-like schema của Web Tools
const NATIVE_TOOLS_SCHEMA = erpToolsRegistry
  .filter(tool => webAllowedTools.has(tool.name))
  .map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.schema || {},
      }
    }
  }));

async function ollamaToolCallingTurn(messages: ChatMsg[]): Promise<{ message?: string; tool_calls?: any[] }> {
  try {
    const url = `${config.ollamaHost}/v1/chat/completions`; // LiteLLM/Ollama OpenAI compatible endpoint
    const body = {
      model: config.ollamaModel,
      messages: messages,
      tools: NATIVE_TOOLS_SCHEMA,
      temperature: 0.15,
    };
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-cic-2026'
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText}`);
    }
    
    const data = await res.json() as any;
    const msg = data.choices[0].message;
    
    // Polyfill cho LLM vLLM đôi khi trả về tool dưới dạng văn bản thô
    if (!msg.tool_calls && msg.content && msg.content.includes('call:')) {
      const match = msg.content.match(/call:([a-zA-Z0-9_]+)\{([^}]*)\}/);
      if (match) {
        const functionName = match[1];
        let args = {};
        try {
          let argsStr = '{' + match[2] + '}';
          argsStr = argsStr.replace(/([a-zA-Z0-9_]+):/g, '"$1":').replace(/'/g, '"');
          args = JSON.parse(argsStr);
        } catch (e) {}

        msg.tool_calls = [{
          function: { name: functionName, arguments: args }
        }];
        console.log(`[Polyfill] Extracted tool call: ${functionName}`, args);
      }
    }
    
    return {
      message: msg.content,
      tool_calls: msg.tool_calls
    };
  } catch (err) {
    console.error("Lỗi gọi AI API:", err);
    return {};
  }
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

      const guarded = { tool: functionName, args };
      let output = '';

      if (!isValidAgentTool(guarded.tool)) {
        output = `Lỗi: Tool ${guarded.tool} không tồn tại. Yêu cầu LLM không dùng tool giả mạo.`;
      } else {
        usedTools.push(guarded.tool);
        try {
          const result = await executeErpTool(params.chatId, params.ctx, guarded.tool, guarded.args);
          output = result;

          // Web tools không cần TERMINAL_TOOLS do nó xử lý hoàn toàn qua LLM
          // Trừ tool export_document có thể cần can thiệp nếu cần. 
          const TERMINAL_TOOLS: string[] = []; // Tạm tắt short-circuit cho web tools vì web tools thiết kế để LLM đọc và phản hồi
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
