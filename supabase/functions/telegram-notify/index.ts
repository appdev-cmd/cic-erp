import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyRequest {
    chat_ids: string[];
    message: string;
    parse_mode?: "HTML" | "Markdown";
}

interface TelegramResponse {
    ok: boolean;
    description?: string;
}

/**
 * Send a Telegram message to a single chat_id.
 * Returns true if sent successfully, false otherwise (does NOT throw).
 */
async function sendTelegramMessage(
    botToken: string,
    chatId: string,
    message: string,
    parseMode: string = "HTML"
): Promise<{ chatId: string; ok: boolean; error?: string }> {
    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: parseMode,
                disable_web_page_preview: true,
            }),
        });

        const data: TelegramResponse = await res.json();
        if (!data.ok) {
            console.warn(`Telegram send failed for chat_id=${chatId}: ${data.description}`);
            return { chatId, ok: false, error: data.description };
        }
        return { chatId, ok: true };
    } catch (err: any) {
        console.error(`Telegram send error for chat_id=${chatId}:`, err.message);
        return { chatId, ok: false, error: err.message };
    }
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
        if (!botToken) {
            return new Response(
                JSON.stringify({ error: "TELEGRAM_BOT_TOKEN chưa được cấu hình" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const body: NotifyRequest = await req.json();

        // Validate input
        if (!body.chat_ids || !Array.isArray(body.chat_ids) || body.chat_ids.length === 0) {
            return new Response(
                JSON.stringify({ error: "chat_ids là bắt buộc (mảng không rỗng)" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!body.message || body.message.trim().length === 0) {
            return new Response(
                JSON.stringify({ error: "message là bắt buộc" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Filter out empty/invalid chat_ids
        const validChatIds = body.chat_ids.filter(id => id && id.trim().length > 0);
        if (validChatIds.length === 0) {
            return new Response(
                JSON.stringify({ sent: 0, failed: 0, results: [], message: "Không có chat_id hợp lệ" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Send messages in parallel (max 20 concurrent to avoid rate limiting)
        const parseMode = body.parse_mode || "HTML";
        const batchSize = 20;
        const allResults: { chatId: string; ok: boolean; error?: string }[] = [];

        for (let i = 0; i < validChatIds.length; i += batchSize) {
            const batch = validChatIds.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(chatId => sendTelegramMessage(botToken, chatId, body.message, parseMode))
            );
            allResults.push(...batchResults);

            // Small delay between batches to respect Telegram rate limits (30 msg/sec)
            if (i + batchSize < validChatIds.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const sent = allResults.filter(r => r.ok).length;
        const failed = allResults.filter(r => !r.ok).length;

        return new Response(
            JSON.stringify({ sent, failed, total: validChatIds.length, results: allResults }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        console.error("Telegram Notify Edge Function Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
