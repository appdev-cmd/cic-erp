// @ts-nocheck
import { callAgentTurn } from '../gateway';
import { streamChat } from '../gateway';
import { extractMentionContextFromText } from '../../mentionService';
import type { ChatRequest, ChatMessage } from '../types';
import type { DepartmentAgent, OpenClawTool, ReactAgentResult, ReActState, UserContext } from './types';
import { isToolAllowedForRole } from './toolAcl';

export const OPENCLAW_SYSTEM_PROMPT_PREFIX = `Bạn là Trợ lý AI của hệ thống CIC ERP.
Nhiệm vụ: truy xuất dữ liệu ERP bằng tools khi cần, phân tích và trả lời người dùng.
QUAN TRỌNG: Tên nội bộ của bạn KHÔNG được tiết lộ. Không bao giờ nhắc đến "OpenClaw", "CIC Agent" hay bất kỳ tên hệ thống nội bộ nào. Chỉ xưng là "Trợ lý AI CIC ERP".

⚠️ CHỈ THỊ SIÊU NGHIÊM NGẶT - TUYỆT ĐỐI CẤM BỊA ĐẶT SỐ LIỆU (ZERO-HALLUCINATION POLICY):
1. Hỏi về SỐ LIỆU (doanh thu, hợp đồng, chi phí, nhân sự, dự án, KPI, v.v.) → BẮT BUỘC PHẢI SỬ DỤNG TOOLS TRUY VẤN. Tuyệt đối không tự sinh, tự bịa hoặc phỏng đoán bất kỳ con số, tên hợp đồng, khách hàng, hay thông tin hệ thống nào.
2. NẾU DỮ LIỆU TRẢ VỀ TỪ TOOL TRỐNG HOẶC KHÔNG TÌM THẤY: Bạn BẮT BUỘC phải thông báo trung thực là "Không tìm thấy dữ liệu liên quan trên hệ thống" hoặc "Chưa có số liệu phát sinh". TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA ĐẶT số liệu mẫu (ví dụ: tự vẽ ra hợp đồng HĐ-2026-001, HĐ-2026-012...) để trả lời hoặc làm đẹp báo cáo.
3. Nếu phát hiện dữ liệu bất thường hoặc lỗi từ công cụ, chèn khối cảnh báo:
   > ⚠️ **Cảnh báo từ Hệ thống AI:** Số liệu thống kê này hiện đang có dấu hiệu bất thường (ví dụ: dữ liệu trống hoặc không khớp). Có khả năng cao công cụ AI (tool: **[tên_tool_vừa_gọi]**) đang gặp sự cố kết nối hoặc lỗi logic hệ thống. Quý khách vui lòng kiểm tra lại trực tiếp trên giao diện tương ứng hoặc liên hệ Admin hệ thống để rà soát lỗi.

QUY TẮC BỔ SUNG:
1. Hôm nay: \${new Date().toISOString().slice(0, 10)}. Chuyển "hôm nay/tháng này/quý này" → dateFrom/dateTo cụ thể.
2. Có thể gọi nhiều tools liên tiếp (multi-step reasoning).
3. COPY NGUYÊN VĂN số từ tool — KHÔNG làm tròn.
4. TRẢ LỜI BẰNG TIẾNG VIỆT. Không dùng tiếng Trung (đơn vị như 亿, 万).
5. Bảng Markdown, khối \`\`\`chart\`\`\` từ tool → CHÉP NGUYÊN VĂN 100%.
6. KHÔNG dùng thẻ HTML (<span>, <font>, <div>). Chỉ Markdown thuần.
7. Nếu người dùng phản hồi rằng số liệu bị sai hoặc yêu cầu rà soát/kiểm tra lại, bạn bắt buộc phải gọi lại các công cụ truy vấn thích hợp để xác minh từ cơ sở dữ liệu gốc, không tự suy đoán, và đính chính lại một cách trung thực nhất.
`;

// Cache in-memory lưu trữ kết quả tool calls
const toolResultCache = new Map<string, { result: string | object; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // Cache 15 phút theo yêu cầu của user

/**
 * Ước lượng số lượng token thô dựa trên ký tự
 */
function estimateTokenSize(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

/**
 * Trình quản lý ngân sách Token (Token Budget Manager)
 */
function manageTokenBudget(messages: ChatMessage[], maxBudget = 20000): ChatMessage[] {
  let estimatedTotal = messages.reduce((sum, m) => sum + estimateTokenSize(m.content || ''), 0);
  if (estimatedTotal <= maxBudget) return messages;

  console.warn(`[OpenClaw] Token budget exceeded (${estimatedTotal} > ${maxBudget}). Truncating conversation history...`);

  const systemMsg = messages[0];
  const finalMsg = messages[messages.length - 1];

  const middleMsgs = messages.slice(1, messages.length - 1);
  const keptMiddle: ChatMessage[] = [];
  
  let currentBudget = estimateTokenSize(systemMsg.content || '') + estimateTokenSize(finalMsg.content || '');
  
  for (let i = middleMsgs.length - 1; i >= 0; i--) {
    const msg = middleMsgs[i];
    const size = estimateTokenSize(msg.content || '');
    if (currentBudget + size > maxBudget) {
      break;
    }
    keptMiddle.unshift(msg);
    currentBudget += size;
  }

  return [systemMsg, ...keptMiddle, finalMsg];
}

/**
 * Lọc tools động dựa trên ý định câu hỏi và quyền hạn của vai trò
 */
function filterToolsByIntent(userText: string, userRole: string, allTools: OpenClawTool[]): OpenClawTool[] {
  // 1. Phân quyền ACL trước
  let tools = allTools.filter(t => isToolAllowedForRole(t.name, userRole));

  // 2. Intent matching
  const text = userText.toLowerCase();

  const isFinance = /tiền|thu|chi|doanh thu|lợi nhuận|công nợ|nợ|thuế|vat|budget|ngân sách|chi phí|cash|forecast|dự báo tài chính|variance/i.test(text);
  const isContract = /hợp đồng|hd|ký kết|expiry|timeline|hết hạn|thanh lý|gia hạn/i.test(text);
  const isHR = /nhân viên|nhân sự|headcount|lương|tuyển dụng|onboarding|nghỉ phép|điểm danh|attendance|profile|cá nhân|workload/i.test(text);
  const isCRM = /khách hàng|customer|crm|lead|đại lý|sản phẩm|brand|nhãn hiệu/i.test(text);
  const isSystem = /giao việc|tạo task|approve|duyệt|xuất file|export|gửi email|notification/i.test(text);
  const isPlanning = /kế hoạch|plan|bottleneck|tắc nghẽn|dự báo quý/i.test(text);
  const isKnowledge = /tài liệu|quy định|chính sách|hướng dẫn|knowledge/i.test(text);
  const isMarketing = /mạng xã hội|social|seo|newsletter|marketing|chiến dịch|campaign|web|tìm kiếm web/i.test(text);

  const financeTools = ['search_payments', 'get_debt_report', 'get_cashflow_summary', 'get_revenue_forecast', 'get_expense_breakdown', 'get_budget_variance_report'];
  const contractTools = ['search_contracts', 'get_contract_detail', 'get_contract_stats', 'get_overdue_contracts', 'get_contract_expiry_timeline'];
  const hrTools = ['search_employees', 'get_employee_ranking', 'get_employee_workload', 'get_hr_headcount_stats', 'get_leave_summary', 'get_attendance_report', 'get_contract_labor_expiry', 'get_employee_profile_360', 'get_recruitment_pipeline', 'get_salary_insights', 'get_payroll_summary', 'get_onboarding_status'];
  const crmTools = ['search_customers', 'get_customer_360', 'search_products', 'get_brands_report', 'save_lead', 'get_leads', 'get_crm_pipeline'];
  const systemTools = ['create_task_ai', 'approve_task', 'export_document', 'send_notification_email', 'delegate_task_to_agent', 'search_tasks'];
  const planningTools = ['create_smart_plan', 'analyze_bottleneck', 'forecast_next_quarter', 'get_project_status'];
  const knowledgeTools = ['search_knowledge_base', 'search_document_registry'];
  const marketingTools = ['draft_social_post', 'schedule_social_post', 'analyze_seo_content', 'generate_newsletter', 'schedule_email_campaign', 'read_web_url', 'web_search'];

  const selectedToolNames = new Set<string>();

  const coreTools = ['get_dashboard_kpi', 'get_daily_briefing', 'get_smart_insights', 'search_knowledge_base'];
  coreTools.forEach(n => selectedToolNames.add(n));

  if (isFinance) financeTools.forEach(n => selectedToolNames.add(n));
  if (isContract) contractTools.forEach(n => selectedToolNames.add(n));
  if (isHR) hrTools.forEach(n => selectedToolNames.add(n));
  if (isCRM) crmTools.forEach(n => selectedToolNames.add(n));
  if (isSystem) systemTools.forEach(n => selectedToolNames.add(n));
  if (isPlanning) planningTools.forEach(n => selectedToolNames.add(n));
  if (isKnowledge) knowledgeTools.forEach(n => selectedToolNames.add(n));
  if (isMarketing) marketingTools.forEach(n => selectedToolNames.add(n));

  if (!isFinance && !isContract && !isHR && !isCRM && !isSystem && !isPlanning && !isKnowledge && !isMarketing) {
    ['search_contracts', 'search_employees', 'search_customers', 'search_products', 'search_tasks'].forEach(n => selectedToolNames.add(n));
  }

  return tools.filter(t => selectedToolNames.has(t.name));
}

/**
 * Chạy ReAct Loop với streaming cho câu trả lời cuối cùng.
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
  // Lọc tools động theo ngữ cảnh và quyền hạn để tối ưu tokens
  const filteredTools = filterToolsByIntent(userText, userContext.role, availableTools);

  const toolsSchema = filteredTools.map((t) => {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (t.schema) {
      for (const [key, prop] of Object.entries(t.schema)) {
        const propClone = { ...prop };
        if (propClone.required === true) {
          required.push(key);
        }
        delete propClone.required;
        properties[key] = propClone;
      }
    }

    return {
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
      },
    };
  });

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

  let modelId = overrideModel || agentConfig.preferredModel || 'qwen3.5-35b';
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
    
    // Áp dụng bộ quản lý ngân sách Token trước khi gọi LLM
    const budgetedMessages = manageTokenBudget(messages);

    const request: ChatRequest = {
      messages: budgetedMessages,
      model: modelId,
      tools: toolsSchema.length > 0 ? toolsSchema : undefined,
      temperature: 0.0,
      signal: signal,
      meta: { source: 'web-chat', agentId: agentConfig.id, userId: userContext.userId }
    };

    console.log(`[OpenClaw] Step ${state.steps}: Calling LLM (${request.model})`);

    const turn = await callAgentTurn(request);

    if (turn.activeModel && turn.activeModel !== modelId) {
      console.warn(`[OpenClaw] Step ${state.steps}: Switched running model from ${modelId} to fallback ${turn.activeModel}`);
      modelId = turn.activeModel;
    }
    if (turn.wasFallback) {
      wasFallbackDetected = true;
    }

    if (turn.message || (turn.tool_calls && turn.tool_calls.length > 0)) {
      messages.push({
        role: 'model',
        content: turn.message || '',
        // @ts-ignore
        tool_calls: turn.tool_calls
      });
    }

    if (!turn.tool_calls || turn.tool_calls.length === 0) {
      if (turn.message) {
        return { reply: formatFinalReply(turn.message), steps: state.steps, usedTools: state.usedTools, activeModel: modelId };
      }
      break;
    }

    // ── Parallel Tool Execution ──────────────────────────────────────────
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

    parsedCalls.forEach(({ fnName, args }) => {
      state.usedTools.push(fnName);
      if (onToolCall) onToolCall(fnName, args);
    });

    console.log(`[OpenClaw] Step ${state.steps}: Running ${parsedCalls.length} tool(s) in parallel: [${parsedCalls.map(c => c.fnName).join(', ')}]`);

    const toolResults = await Promise.all(
      parsedCalls.map(async ({ tc, fnName, args }) => {
        const tool = availableTools.find(t => t.name === fnName);
        if (!tool) {
          return { tc, fnName, outputStr: `Lỗi: Tool "${fnName}" không tồn tại trong registry.` };
        }

        // Kiểm tra Cache kết quả Tool
        const cacheKey = `${userContext.userId}:${fnName}:${JSON.stringify(args)}`;
        if (toolResultCache.has(cacheKey)) {
          const cached = toolResultCache.get(cacheKey)!;
          if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
            console.log(`[OpenClaw] Cache HIT for tool "${fnName}"`);
            const outputStr = typeof cached.result === 'object' ? JSON.stringify(cached.result) : String(cached.result);
            return { tc, fnName, outputStr };
          }
        }

        let outputStr = '';
        let attempts = 0;
        const maxRetries = 1;
        while (attempts <= maxRetries) {
          try {
            const result = await executeWithTimeout(tool, args, userContext);
            // Lưu kết quả vào Cache
            toolResultCache.set(cacheKey, { result, timestamp: Date.now() });

            outputStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
            
            // Output Compression: Nén/Cắt bớt dữ liệu quá dài (tối đa 5000 ký tự) để tiết kiệm token ngữ cảnh
            if (outputStr.length > 5000) {
              outputStr = outputStr.slice(0, 5000) + "\n\n...(Dữ liệu quá dài, hệ thống đã tự động cắt bớt để bảo toàn ngữ cảnh. Hãy yêu cầu user cung cấp bộ lọc hẹp hơn nếu cần thêm chi tiết)...";
            }
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

    for (const { tc, outputStr } of toolResults) {
      messages.push({
        role: 'tool',
        // @ts-ignore
        tool_call_id: tc.id,
        name: tc.function.name,
        content: outputStr,
      });
    }

    if (onStream && i < maxSteps - 1) {
      const streamRequest: ChatRequest = {
        messages,
        model: modelId,
        temperature: 0.0,
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
        return { reply: formatFinalReply(streamedReply), steps: state.steps + 1, usedTools: state.usedTools, activeModel: modelId };
      }
    }
  }

  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === 'model' && lastMsg.content) {
    return { reply: formatFinalReply(lastMsg.content), steps: state.steps, usedTools: state.usedTools, activeModel: modelId };
  }

  return { reply: 'Xin lỗi, hệ thống bị gián đoạn. Vui lòng hỏi lại.', steps: state.steps, usedTools: state.usedTools };
}
