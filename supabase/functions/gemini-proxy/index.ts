import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.21.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
    action: "analyze" | "query" | "insights" | "chat";
    // analyze
    text?: string;
    // query
    query?: string;
    data?: any;
    // insights
    contracts?: any[];
    // chat
    history?: { role: "user" | "model"; content: string }[];
    newMessage?: string;
    modelId?: string;
    systemInstruction?: string;
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "GEMINI_API_KEY chưa được cấu hình trên server" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body: RequestBody = await req.json();
        const genAI = new GoogleGenerativeAI(apiKey);

        // ─── ACTION: analyze ────────────────────────────────────
        if (body.action === "analyze") {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{
                        text: `Hãy phân tích nội dung hợp đồng sau đây và tóm tắt các điểm quan trọng (Bên A, Bên B, Giá trị, Thời hạn, Rủi ro tiềm ẩn). Định dạng bằng tiếng Việt, súc tích, chuyên nghiệp:\n\n${body.text}`,
                    }],
                }],
                generationConfig: { temperature: 0.2 },
            });
            return new Response(
                JSON.stringify({ result: result.response.text() }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ─── ACTION: query ──────────────────────────────────────
        if (body.action === "query") {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const result = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{
                        text: `Bạn là trợ lý quản trị cấp cao của ContractPro. Dựa trên dữ liệu hệ thống dưới đây, hãy trả lời câu hỏi của người dùng một cách chính xác, ngắn gọn và có phân tích chuyên môn.\n\nDữ liệu hệ thống: ${JSON.stringify(body.data)}\nCâu hỏi: ${body.query}`,
                    }],
                }],
                generationConfig: { temperature: 0.1 },
            });
            return new Response(
                JSON.stringify({ result: result.response.text() }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ─── ACTION: insights ───────────────────────────────────
        if (body.action === "insights") {
            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                generationConfig: { responseMimeType: "application/json" },
            });

            const simplifiedData = (body.contracts || []).map((c: any) => ({
                id: c.id, val: c.value, client: c.partyA,
                status: c.status, revenue: c.actualRevenue,
                date: c.endDate, unit: c.unitId,
            }));
            const sample = simplifiedData.sort(() => 0.5 - Math.random()).slice(0, 40);

            const result = await model.generateContent({
                contents: [{
                    role: "user",
                    parts: [{
                        text: `Bạn là chuyên gia phân tích dữ liệu doanh nghiệp. Dựa trên danh sách ${(body.contracts || []).length} hợp đồng (dưới đây là mẫu ${sample.length} bản ghi), hãy đưa ra 3 nhận xét quan trọng (Insights) giúp quản lý ra quyết định.\n\nYêu cầu:\n1. Tập trung vào: Tiến độ doanh thu, Rủi ro khách hàng (nếu có), hoặc Hiệu suất đơn vị.\n2. Ngắn gọn, súc tích (dưới 30 từ/insight).\n3. Output JSON format: [{"title": "Tiêu đề ngắn", "content": "Nội dung chi tiết", "type": "warning|info|success"}]\n\nDữ liệu mẫu: ${JSON.stringify(sample)}`,
                    }],
                }],
                generationConfig: { temperature: 0.3 },
            });

            return new Response(
                JSON.stringify({ result: JSON.parse(result.response.text() || "[]") }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ─── ACTION: chat (streaming) ───────────────────────────
        if (body.action === "chat") {
            const validModelId =
                body.modelId === "gemini-2.0-flash" ? "gemini-2.0-flash"
                    : body.modelId === "gemini-1.5-pro" ? "gemini-1.5-pro-latest"
                        : body.modelId === "gemini-pro" ? "gemini-pro"
                            : "gemini-2.0-flash";

            const model = genAI.getGenerativeModel({
                model: validModelId,
                systemInstruction: body.systemInstruction ||
                    "Bạn là Trợ lý AI Enterprise của hệ thống ContractPro. Trả lời chuyên nghiệp, ngắn gọn, Format dạng Markdown đẹp mắt.",
            });

            let validHistory = (body.history || []).filter((msg) => msg.content.trim() !== "");
            while (validHistory.length > 0 && validHistory[0].role !== "user") {
                validHistory.shift();
            }

            // Chuẩn hóa và nhóm gộp các tin nhắn trùng vai trò liên tiếp (Tránh lỗi Gemini 400 INVALID_ARGUMENT)
            const chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
            for (const msg of validHistory) {
                // Coi role 'model' hoặc 'assistant' là 'model', còn lại ('user', 'tool') đều là 'user'
                const role: 'user' | 'model' = (msg.role === 'model' || msg.role === 'assistant') ? 'model' : 'user';
                const content = msg.content || '';

                if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === role) {
                    // Ghép nối nội dung nếu trùng vai trò liên tiếp
                    chatHistory[chatHistory.length - 1].parts[0].text += '\n\n' + content;
                } else {
                    chatHistory.push({
                        role,
                        parts: [{ text: content }]
                    });
                }
            }

            let lastMessage = body.newMessage || "";

            // ĐẢM BẢO TUÂN THỦ NGHIÊM NGẶT QUY TẮC CỦA GEMINI:
            // Vì tin nhắn gửi qua `sendMessageStream` luôn có vai trò mặc định là 'user',
            // tin nhắn cuối cùng trong `chatHistory` bắt buộc phải có vai trò là 'model' (hoặc history trống).
            // Nếu tin nhắn cuối trong `chatHistory` là 'user', chúng ta pop nó ra và ghép vào đầu `lastMessage`.
            if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
                const popped = chatHistory.pop();
                const poppedText = popped?.parts[0]?.text || '';
                if (poppedText) {
                    lastMessage = poppedText + '\n\n' + lastMessage;
                }
            }

            const chat = model.startChat({
                history: chatHistory,
                generationConfig: { temperature: 0.3 },
            });

            const result = await chat.sendMessageStream(lastMessage);

            // Stream response using ReadableStream
            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        if (text) {
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                        }
                    }
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                },
            });

            return new Response(stream, {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            });
        }

        return new Response(
            JSON.stringify({ error: `Action không hợp lệ: ${body.action}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Edge Function Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
