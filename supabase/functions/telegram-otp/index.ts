import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { action, telegramId, otpCode, employeeId } = body;

        // Verify user auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("Missing Authorization header");

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        
        // Use service role for DB bypass (insert/update otp which is protected by RLS)
        const supabase = createClient(supabaseUrl, serviceKey);

        const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) throw new Error("Unauthorized");

        if (action === "send") {
            if (!telegramId || !employeeId) throw new Error("Missing telegramId or employeeId");

            // Xóa OTP cũ chưa verify cho user này
            await supabase.from("telegram_otp")
                .delete()
                .eq("employee_id", employeeId)
                .eq("verified", false);

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            // TTL 5 minutes
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

            const { error: insertError } = await supabase.from("telegram_otp")
                .insert({
                    employee_id: employeeId,
                    telegram_id: telegramId,
                    otp_code: otp,
                    expires_at: expiresAt
                });

            if (insertError) throw new Error("Failed to create OTP: " + insertError.message);

            // Gửi OTP qua Telegram API
            const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
            if (!botToken) {
                // Nếu chưa cấu hình bot (như trên dev local), mock response success
                console.warn("Missing TELEGRAM_BOT_TOKEN. Simulated OTP send. CODE: " + otp);
                return new Response(JSON.stringify({ success: true, simulated: true, otp: otp }), { headers: corsHeaders });
            }

            const msg = `🔐 <b>Mã xác thực hệ thống CIC ERP của bạn là:</b> <code>${otp}</code>\n<i>Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ cho bất kỳ ai.</i>`;
            
            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: telegramId, text: msg, parse_mode: "HTML" })
            });
            const tgData = await tgRes.json();
            
            if (!tgData.ok) {
                // Trả về error rõ ràng để client xử lý
                if (tgData.description?.includes("chat not found")) {
                     return new Response(JSON.stringify({ error: "BOT_NOT_STARTED" }), { headers: corsHeaders });
                }
                throw new Error("Telegram API Error: " + tgData.description);
            }

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        if (action === "verify") {
            if (!telegramId || !employeeId || !otpCode) throw new Error("Missing arguments");

            const { data, error } = await supabase.from("telegram_otp")
                .select("*")
                .eq("employee_id", employeeId)
                .eq("telegram_id", telegramId)
                .eq("otp_code", otpCode)
                .eq("verified", false)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                return new Response(JSON.stringify({ error: "Mã OTP không đúng." }), { status: 400, headers: corsHeaders });
            }

            if (new Date(data.expires_at) < new Date()) {
                return new Response(JSON.stringify({ error: "Mã OTP đã hết hạn." }), { status: 400, headers: corsHeaders });
            }

            // Đánh dấu là đã xác thực
            await supabase.from("telegram_otp").update({ verified: true }).eq("id", data.id);
            
            // Cập nhật profile employee
            await supabase.from("employees").update({ 
                telegram: telegramId,
                telegram_verified: true 
            }).eq("id", employeeId);

            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        throw new Error("Invalid action parameter");

    } catch (e: any) {
        console.error("Function Error:", e);
        return new Response(JSON.stringify({ error: e.message || "Internal server error" }), { 
            status: 500, 
            headers: corsHeaders 
        });
    }
});
