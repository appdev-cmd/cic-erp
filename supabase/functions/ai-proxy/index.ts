import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@4.28.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
    action: "chat" | "analyze" | "query" | "insights";
    provider: "openai" | "deepseek";
    history?: { role: "user" | "model" | "assistant" | "system"; content: string }[];
    newMessage?: string;
    modelId?: string;
    systemInstruction?: string;
    text?: string;
    query?: string;
    data?: any;
    contracts?: any[];
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body: RequestBody = await req.json();

        // --- Init Client ---
        let client: OpenAI;
        let apiKey: string | undefined;
        let baseURL: string | undefined;

        if (body.provider === "deepseek") {
            apiKey = Deno.env.get("DEEPSEEK_API_KEY");
            baseURL = 'https://api.deepseek.com';
            if (!apiKey) throw new Error("DEEPSEEK_API_KEY chưa được cấu hình trên server");
        } else {
            apiKey = Deno.env.get("OPENAI_API_KEY");
            if (!apiKey) throw new Error("OPENAI_API_KEY chưa được cấu hình trên server");
        }

        client = new OpenAI({
            apiKey: apiKey,
            baseURL: baseURL,
        });

        // ─── ACTION: chat (streaming) ───────────────────────────
        if (body.action === "chat") {
            const apiModelId = body.modelId === "deepseek-r1" ? "deepseek-reasoner" : body.modelId || (body.provider === "deepseek" ? "deepseek-chat" : "gpt-4o-mini");

            const messages: any[] = (body.history || []).map(msg => ({
                role: msg.role === 'model' ? 'assistant' : msg.role,
                content: msg.content
            }));

            if (body.systemInstruction) {
                messages.unshift({ role: 'system', content: body.systemInstruction });
            }

            if (body.newMessage) {
                messages.push({ role: 'user', content: body.newMessage });
            }

            const stream = await client.chat.completions.create({
                model: apiModelId,
                messages: messages,
                stream: true,
                temperature: apiModelId === 'deepseek-reasoner' ? undefined : 0.7,
            });

            const readableStream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    try {
                        for await (const chunk of stream) {
                            const content = chunk.choices[0]?.delta?.content || '';
                            if (content) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`));
                            }
                        }
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    } catch (e) {
                        console.error("Stream error:", e);
                    } finally {
                        controller.close();
                    }
                }
            });

            return new Response(readableStream, {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            });
        }

        // ─── ACTION: analyze (DeepSeek Specific) ────────────────
        if (body.action === "analyze") {
            const response = await client.chat.completions.create({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: "system",
                        content: "Bạn là chuyên gia pháp lý và quản trị hợp đồng. Nhiệm vụ của bạn là phân tích hợp đồng và đưa ra báo cáo rủi ro định dạng HTML (dùng thẻ <b>, <br>, <ul>, <li>, <span class='text-red-500'> cho rủi ro cao)."
                    },
                    {
                        role: "user",
                        content: `Hãy phân tích nội dung hợp đồng sau đây và tóm tắt các điểm quan quan trọng (Bên A, Bên B, Giá trị, Thời hạn, Rủi ro tiềm ẩn). Định dạng bằng tiếng Việt, súc tích, chuyên nghiệp. Nhấn mạnh vào rủi ro thanh toán và tiến độ: \n\n ${body.text}`
                    }
                ],
                temperature: 0.2,
            });

            return new Response(
                JSON.stringify({ result: response.choices[0].message.content || "Không có phản hồi." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ─── ACTION: query (DeepSeek Specific) ──────────────────
        if (body.action === "query") {
            const response = await client.chat.completions.create({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: "system",
                        content: "Bạn là trợ lý quản trị cấp cao của ContractPro. Dựa trên dữ liệu hệ thống được cung cấp, hãy trả lời câu hỏi của người dùng một cách chính xác, ngắn gọn và có phân tích chuyên môn. Định dạng Markdown."
                    },
                    {
                        role: "user",
                        content: `Dữ liệu hệ thống: ${JSON.stringify(body.data)}\n\nCâu hỏi: ${body.query}`
                    }
                ],
                temperature: 0.1,
            });

            return new Response(
                JSON.stringify({ result: response.choices[0].message.content || "Không có phản hồi." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ─── ACTION: insights (DeepSeek Specific) ───────────────
        if (body.action === "insights") {
            const simplifiedData = (body.contracts || []).map(c => ({
                id: c.id, val: c.value, client: c.partyA, status: c.status,
                revenue: c.actualRevenue, date: c.endDate, unit: c.unitId
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
                        content: `Dựa trên danh sách ${(body.contracts || []).length} hợp đồng (mẫu dưới đây), đưa ra 3 nhận xét quan trọng (Insights).
                        Dữ liệu mẫu: ${JSON.stringify(sample)}`
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            });

            const content = response.choices[0]?.message?.content || "[]";
            const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(jsonStr);

            return new Response(
                JSON.stringify({ result: parsed }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ error: `Action không hợp lệ: ${body.action}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("AI Proxy Edge Function Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
