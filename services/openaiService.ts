import OpenAI from 'openai';

interface ChatMessage {
    role: 'user' | 'model' | 'assistant' | 'system';
    content: string;
}

// Helper to create client based on provider
const createClient = (provider: 'openai' | 'deepseek') => {
    if (provider === 'openai') {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) throw new Error("Missing VITE_OPENAI_API_KEY");
        return new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true // Client-side usage
        });
    } else {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        if (!apiKey) throw new Error("Missing VITE_DEEPSEEK_API_KEY");
        return new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
        });
    }
};

// TODO: Migrate OpenAI/DeepSeek calls to Edge Function (like gemini-proxy) to avoid exposing API keys client-side

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

        const provider = modelId.includes('deepseek') ? 'deepseek' : 'openai';
        const client = createClient(provider);

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
            model: modelId,
            messages: messages,
            stream: true,
            temperature: 0.7,
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
        yield `⚠️ Lỗi kết nối ${modelId}. Vui lòng kiểm tra API Key hoặc tín dụng.\n\nChi tiết: ${error instanceof Error ? error.message : String(error)}`;
    }
}

export async function analyzeContractWithDeepSeek(text: string): Promise<string> {
    try {
        const client = createClient('deepseek');

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
        const client = createClient('deepseek');

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
        const client = createClient('deepseek');

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
            response_format: { type: 'json_object' }, // DeepSeek might support json_object or text. Better to be safe with text but prompt for JSON.
            // Note: OpenAI SDK 'json_object' works if model supports it. DeepSeek V3 typically does.
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
