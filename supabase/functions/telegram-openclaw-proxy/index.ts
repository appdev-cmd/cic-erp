/**
 * Proxy mỏng: Telegram webhook → worker OpenClaw.
 *
 * Cấu hình `setWebhook` của @cic_vn_bot:
 * - url: https://<ref>.supabase.co/functions/v1/telegram-openclaw-proxy
 * - secret_token: cùng giá trị với secrets TELEGRAM_PROXY_SECRET (Supabase) và TELEGRAM_WEBHOOK_SECRET (worker)
 *
 * Secrets Supabase (Edge):
 * - TELEGRAM_PROXY_SECRET — khớp secret_token khi setWebhook
 * - OPENCLAW_WORKER_URL — vd https://bot.example.com (không slash cuối)
 *
 * Secrets worker:
 * - TELEGRAM_WEBHOOK_SECRET — cùng chuỗi với TELEGRAM_PROXY_SECRET
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

  const expected = Deno.env.get("TELEGRAM_PROXY_SECRET") ?? "";
  const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!expected || got !== expected) {
    return unauthorized();
  }

  const workerBase = (Deno.env.get("OPENCLAW_WORKER_URL") ?? "").replace(/\/$/, "");
  if (!workerBase) {
    return new Response(JSON.stringify({ error: "OPENCLAW_WORKER_URL chưa cấu hình" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  const target = `${workerBase}/telegram-webhook`;

  try {
    const fwd = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": got,
      },
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
