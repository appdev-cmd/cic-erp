/**
 * Proxy mỏng: Telegram webhook → worker OpenClaw (HTTPS công khai cố định).
 * Biến môi trường:
 * - TELEGRAM_PROXY_SECRET: phải khớp path secret worker (cùng giá trị TELEGRAM_WEBHOOK_PATH_SECRET trên worker)
 * - OPENCLAW_WORKER_URL: vd https://bot.example.com (không có slash cuối)
 *
 * Đặt webhook Telegram: https://<project>.supabase.co/functions/v1/telegram-openclaw-proxy/<TELEGRAM_PROXY_SECRET>
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const secretFromPath = parts[parts.length - 1] ?? "";
  const expected = Deno.env.get("TELEGRAM_PROXY_SECRET") ?? "";
  const workerBase = (Deno.env.get("OPENCLAW_WORKER_URL") ?? "").replace(/\/$/, "");

  if (!expected || secretFromPath !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!workerBase) {
    return new Response(JSON.stringify({ error: "OPENCLAW_WORKER_URL chưa cấu hình" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  const target = `${workerBase}/webhook/${encodeURIComponent(expected)}`;

  try {
    const fwd = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await fwd.text();
    return new Response(text, {
      status: fwd.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "forward failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
