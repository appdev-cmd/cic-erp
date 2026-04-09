import { supabase } from '../lib/supabase';

// Lấy Custom Key từ LocalStorage
function getCustomOpenAIKey(): string | null {
    try { return localStorage.getItem('cic_custom_openai_key') || null; }
    catch { return null; }
}

function getCustomDeepseekKey(): string | null {
    try { return localStorage.getItem('cic_custom_deepseek_key') || null; }
    catch { return null; }
}

export function getLocalAIBaseURL(): string {
    try { return localStorage.getItem('cic_local_ai_base_url') || 'http://localhost:11434/v1'; }
    catch { return 'http://localhost:11434/v1'; }
}

export function isLocalAIPriority(): boolean {
    try { return localStorage.getItem('cic_local_ai_priority') === 'true'; }
    catch { return false; }
}

// ─── Helper: Gọi Edge Function an toàn ─────────────────────
async function callEdgeFunction(action: string, payload: Record<string, any>): Promise<any> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action, ...payload },
    });

    if (error) {
        console.warn(`[AI Proxy] Edge Function lỗi (${action}):`, error.message);
        throw new Error(error.message);
    }

    return data;
}

// ─── Kiểm tra Edge Function có sẵn không ───────────────────
let edgeFunctionAvailable: boolean | null = null;

async function isEdgeFunctionAvailable(): Promise<boolean> {
    if (edgeFunctionAvailable !== null) return edgeFunctionAvailable;

    try {
        // Thử gọi với action không hợp lệ để kiểm tra kết nối
        await supabase.functions.invoke('ai-proxy', {
            body: { action: 'ping', provider: 'deepseek' }, // ping to check
        });
        edgeFunctionAvailable = true;
    } catch {
        edgeFunctionAvailable = false;
    }
    return edgeFunctionAvailable;
}

// Helper to create client based on provider for Direct Calls (Fallback)
const createDirectClient = async (provider: 'openai' | 'deepseek' | 'local') => {
    // Dynamic import to avoid bundling if not used locally
    const { default: OpenAI } = await import('openai');

    if (provider === 'local') {
        const baseURL = getLocalAIBaseURL();
        return new OpenAI({
            baseURL: baseURL,
            apiKey: 'cic-secret-ai-2026', // Phải khớp với khoá bí mật thiết đặt bên vLLM
            dangerouslyAllowBrowser: true,
        });
    } else if (provider === 'openai') {
        const apiKey = getCustomOpenAIKey() || import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) throw new Error("Missing OpenAI API Key. Vui lòng cấu hình trong Cài đặt.");
        return new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true // Client-side usage
        });
    } else {
        const apiKey = getCustomDeepseekKey() || import.meta.env.VITE_DEEPSEEK_API_KEY;
        if (!apiKey) throw new Error("Missing DeepSeek API Key. Vui lòng cấu hình trong Cài đặt.");
        return new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
        });
    }
};

export async function* streamOpenAIChat(
    history: { role: 'user' | 'model', content: string }[],
    newMessage: string,
    modelId: string,
    systemInstruction?: string,
    signal?: AbortSignal
) {
    try {
        // Check abort before starting
        if (signal?.aborted) return;

        let provider: 'openai' | 'deepseek' | 'local' = modelId.includes('deepseek') ? 'deepseek' : 'openai';
        if (isLocalAIPriority() || modelId.includes('local') || modelId.includes('gemma') || modelId.includes('qwen') || modelId.includes('llama')) {
            provider = 'local';
        }

        const customKey = provider === 'deepseek' ? getCustomDeepseekKey() : getCustomOpenAIKey();
        const shouldUseEdge = provider !== 'local' && !customKey && await isEdgeFunctionAvailable();

        if (shouldUseEdge) {
            const { data, error } = await supabase.functions.invoke('ai-proxy', {
                body: {
                    action: 'chat',
                    provider,
                    history,
                    newMessage,
                    modelId,
                    systemInstruction,
                },
            });

            if (error) throw error;

            // Parse SSE text
            if (typeof data === 'string') {
                const lines = data.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const parsed = JSON.parse(line.slice(6));
                            if (parsed.text) yield parsed.text;
                        } catch {
                            // skip invalid lines
                        }
                    }
                }
            }
            return;
        }

        // --- Fallback Direct Call ---
        const client = await createDirectClient(provider);

        let apiModelId = modelId;
        if (modelId === 'deepseek-r1') apiModelId = 'deepseek-reasoner';

        // Convert history format
        const messages: any[] = history.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
        }));

        // Add system instruction if present
        if (systemInstruction) {
            messages.unshift({ role: 'system', content: systemInstruction });
        }

        // Add new message
        messages.push({ role: 'user', content: newMessage });

        const stream = await client.chat.completions.create({
            model: apiModelId,
            messages: messages,
            stream: true,
            temperature: apiModelId.includes('reasoner') ? undefined : 0.7, // deepseek-reasoner doesn't support temp
        });

        for await (const chunk of stream) {
            if (signal?.aborted) {
                // Cancel the stream if aborted
                stream.controller.abort();
                return;
            }
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) yield content;
        }

    } catch (error: any) {
        if (error?.name === 'AbortError' || signal?.aborted) return;
        console.error("OpenAI/DeepSeek Stream Error:", error);
        yield `⚠️ Lỗi kết nối ${modelId}. Vui lòng kiểm tra API Key hoặc mạng.\n\nChi tiết: ${error instanceof Error ? error.message : String(error)}`;
    }
}

export async function analyzeContractWithDeepSeek(text: string): Promise<string> {
    try {
        const customKey = getCustomDeepseekKey();
        if (!customKey && await isEdgeFunctionAvailable()) {
            const data = await callEdgeFunction('analyze', { provider: 'deepseek', text });
            return data.result;
        }

        const client = await createDirectClient('deepseek');
        const response = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                {
                    role: "system",
                    content: "Bạn là chuyên gia pháp lý và quản trị hợp đồng. Nhiệm vụ của bạn là phân tích hợp đồng và đưa ra báo cáo rủi ro định dạng HTML (dùng thẻ <b>, <br>, <ul>, <li>, <span class='text-red-500'> cho rủi ro cao)."
                },
                {
                    role: "user",
                    content: `Hãy phân tích nội dung hợp đồng sau đây và tóm tắt các điểm quan quan trọng (Bên A, Bên B, Giá trị, Thời hạn, Rủi ro tiềm ẩn). Định dạng bằng tiếng Việt, súc tích, chuyên nghiệp. Nhấn mạnh vào rủi ro thanh toán và tiến độ: \n\n ${text}`
                }
            ],
            temperature: 0.2,
        });

        return response.choices[0].message.content || "Không có phản hồi từ DeepSeek.";
    } catch (error) {
        console.error("DeepSeek Analysis Error:", error);
        if (String(error).includes("401")) return "Lỗi: Sai hoặc thiếu DeepSeek API Key.";
        if (String(error).includes("402")) return "Lỗi: Hết tín dụng DeepSeek.";
        return "Không thể phân tích hợp đồng bằng DeepSeek lúc này.";
    }
}

export async function querySystemDataWithDeepSeek(query: string, data: any): Promise<string> {
    try {
        // If Local AI is preferred
        if (isLocalAIPriority()) {
            const client = await createDirectClient('local');
            const modelName = localStorage.getItem('cic_local_ai_model') || 'qwen2.5';
            const response = await client.chat.completions.create({
                model: modelName,
                messages: [
                    {
                        role: "system",
                        content: "Bạn là trợ lý quản trị cấp cao của ContractPro. Dựa trên dữ liệu hệ thống được cung cấp, hãy trả lời câu hỏi của người dùng một cách chính xác, ngắn gọn và có phân tích chuyên môn. Bắt buộc format câu trả lời bằng Markdown."
                    },
                    {
                        role: "user",
                        content: `Dữ liệu hệ thống:\n${JSON.stringify(data)}\n\nCâu hỏi: ${query}`
                    }
                ],
                temperature: 0.1,
            });
            return response.choices[0]?.message?.content || "Không có phản hồi từ Trợ lý Local AI.";
        }

        const customKey = getCustomDeepseekKey();
        if (!customKey && await isEdgeFunctionAvailable()) {
            const resultData = await callEdgeFunction('query', { provider: 'deepseek', query, data });
            return resultData.result;
        }

        const client = await createDirectClient('deepseek');
        const response = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                {
                    role: "system",
                    content: "Bạn là trợ lý quản trị cấp cao của ContractPro. Dựa trên dữ liệu hệ thống được cung cấp, hãy trả lời câu hỏi của người dùng một cách chính xác, ngắn gọn và có phân tích chuyên môn. Định dạng Markdown."
                },
                {
                    role: "user",
                    content: `Dữ liệu hệ thống: ${JSON.stringify(data)}\n\nCâu hỏi: ${query}`
                }
            ],
            temperature: 0.1,
        });

        return response.choices[0]?.message?.content || "Không có phản hồi từ DeepSeek.";
    } catch (error) {
        console.error("DeepSeek Query Error:", error);
        return "Tôi đang gặp khó khăn khi kết nối với DeepSeek. Vui lòng kiểm tra API Key.";
    }
}

export async function getSmartInsightsWithDeepSeek(contracts: any[]): Promise<any[]> {
    try {
        const customKey = getCustomDeepseekKey();
        if (!customKey && await isEdgeFunctionAvailable()) {
            const data = await callEdgeFunction('insights', { provider: 'deepseek', contracts });
            return data.result;
        }

        const client = await createDirectClient('deepseek');

        // Simplify data to reduce token usage
        const simplifiedData = contracts.map(c => ({
            id: c.id,
            val: c.value,
            client: c.partyA,
            status: c.status,
            revenue: c.actualRevenue,
            date: c.endDate,
            unit: c.unitId
        }));

        const sample = simplifiedData.sort(() => 0.5 - Math.random()).slice(0, 40);

        const response = await client.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                {
                    role: "system",
                    content: `Bạn là chuyên gia phân tích dữ liệu doanh nghiệp. Nhiệm vụ của nhận xét về tình hình kinh doanh ngắn gọn.
                    Output JSON format STRICTLY: [{"title": "Title", "content": "Content", "type": "warning|info|success"}]`
                },
                {
                    role: "user",
                    content: `Dựa trên danh sách ${contracts.length} hợp đồng (mẫu dưới đây), đưa ra 3 nhận xét quan trọng (Insights).
                    Dữ liệu mẫu: ${JSON.stringify(sample)}`
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content || "[]";
        // Clean markdown code blocks if present
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("DeepSeek Insight Error:", error);
        return [{ title: "Lỗi kết nối AI", content: "Không thể lấy Smart Insights từ DeepSeek.", type: "warning" }];
    }
}
