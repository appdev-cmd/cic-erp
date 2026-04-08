# Worker trợ lý Telegram CIC (OpenClaw-style)

Điều phối **@cic_vn_bot**: xác thực qua RPC `telegram_bot_resolve_context`, báo cáo hợp đồng qua `telegram_bot_contracts_report`, xuất **Excel / DOCX**, tùy chọn **Gemma qua Ollama**.

## Checklist — bạn cần chuẩn bị (không cần gửi cho AI)

| # | Bạn có sẵn / tự điền | Ghi chú |
|---|----------------------|---------|
| 1 | **`TELEGRAM_BOT_TOKEN`** | Token bot @cic_vn_bot (Dashboard đã có / Supabase secrets OTP). Chỉ nhập vào `.env` worker + terminal khi `setWebhook`. |
| 2 | **`SUPABASE_URL`** + **`SUPABASE_SERVICE_ROLE_KEY`** | Service role **chỉ** trên máy chạy worker — lấy Project Settings → API. |
| 3 | **`TELEGRAM_WEBHOOK_SECRET`** (tự tạo 1 chuỗi dài) | Ghi vào `.env` worker **và** Supabase secret `TELEGRAM_PROXY_SECRET` (**trùng nhau**). |
| 4 | **Tunnel HTTPS** | `cloudflared` hoặc ngrok — URL đó ghi vào Supabase `OPENCLAW_WORKER_URL`. Mỗi lần dev tunnel đổi URL thì **sửa lại** secret Supabase. |
| 5 | Tài khoản Telegram trên ERP | `employees.telegram` = chat id, **`telegram_verified = true`**. |

**Đã xong phía cloud (nếu bạn đã làm migration + deploy):** RPC `telegram_bot_*`, Edge `telegram-openclaw-proxy` ACTIVE, webhook URL dạng `https://<ref>.supabase.co/functions/v1/telegram-openclaw-proxy`.

**Bạn không cần cung cấp** token/secret cho người khác — chỉ điền local + Dashboard Supabase.

## Yêu cầu

- Node 20+
- Migration `20260408120000_telegram_bot_secure_rpcs.sql` đã apply trên Supabase
- Secrets: `TELEGRAM_BOT_TOKEN` (cùng bot OTP), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role **chỉ** trên worker, bảo mật máy chủ)

## Cài đặt

```bash
cd workers/cic-telegram-openclaw
cp .env.example .env
# chỉnh .env
npm install
npm run build
npm start
```

## Chạy local (không cần VPS)

**Không có VPS nào “đi kèm” dự án** — VPS chỉ là một cách có domain + HTTPS cố định. Bạn có thể chỉ dùng **máy của mình**:

1. Chạy worker: `npm start` → lắng nghe `http://127.0.0.1:8787`.
2. Telegram **bắt buộc** gọi webhook qua **HTTPS công khai**. Máy local cần một **tunnel** (chọn một):
   - **Cloudflare Tunnel (nhanh):** cài `cloudflared`, chạy  
     `cloudflared tunnel --url http://127.0.0.1:8787`  
     → nhận URL dạng `https://xxxx.trycloudflare.com` (**không** thêm path).
   - Hoặc **ngrok:** `ngrok http 8787` → lấy URL `https://...ngrok...`.
3. Trong **Supabase → Edge Functions → Secrets**, đặt  
   **`OPENCLAW_WORKER_URL`** = đúng origin tunnel đó (vd `https://abcd-1234.trycloudflare.com`, **không** `/` cuối).
4. `TELEGRAM_PROXY_SECRET` = trùng `TELEGRAM_WEBHOOK_SECRET` trong file `.env` worker.
5. Chạy `scripts/set-telegram-webhook.sh` như mục dưới.

Luồng: **Telegram → HTTPS Supabase proxy → HTTPS tunnel → worker trên máy bạn.**

**Ollama / Gemma** vẫn có thể là `http://127.0.0.1:11434` trên cùng máy — chỉ worker Node cần được Internet tới qua tunnel.

## Biến môi trường

| Biến | Mô tả |
|------|--------|
| `PORT` | Cổng HTTP (mặc định 8787) |
| `TELEGRAM_WEBHOOK_SECRET` | Khớp `secret_token` của `setWebhook` (header `X-Telegram-Bot-Api-Secret-Token`) |
| `TELEGRAM_BOT_TOKEN` | Token BotFather |
| `SUPABASE_URL` | URL dự án |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (gọi RPC bot) |
| `OLLAMA_HOST` | Tùy chọn, vd `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Mặc định `gemma2:2b` |
| `REPORT_ROW_CAP` | Mặc định 500, tối đa 2000 |

## Edge Function `telegram-openclaw-proxy` (Supabase)

Đã có thể deploy qua Supabase MCP / CLI. URL webhook cố định:

`https://<PROJECT_REF>.supabase.co/functions/v1/telegram-openclaw-proxy`

**Project CIC ERP (ví dụ):** `https://jyohocjsnsyfgfsmjfqx.supabase.co/functions/v1/telegram-openclaw-proxy`

**Bắt buộc — Secrets trong Dashboard** (Project → Edge Functions → Secrets):

| Secret | Ý nghĩa |
|--------|---------|
| `TELEGRAM_PROXY_SECRET` | Chuỗi dài ngẫu nhiên; **trùng** `TELEGRAM_WEBHOOK_SECRET` trên worker và `secret_token` khi `setWebhook` |
| `OPENCLAW_WORKER_URL` | Origin worker **HTTPS công khai**: domain, **hoặc** URL tunnel local (`https://….trycloudflare.com`) — **không** `/` cuối |

Sau khi worker chạy và 2 secret trên đã đặt, chạy script:

```bash
chmod +x scripts/set-telegram-webhook.sh
export TELEGRAM_BOT_TOKEN="..."           # token @cic_vn_bot
export TELEGRAM_WEBHOOK_SECRET="..."      # = TELEGRAM_PROXY_SECRET
export SUPABASE_FUNCTIONS_URL="https://jyohocjsnsyfgfsmjfqx.supabase.co/functions/v1/telegram-openclaw-proxy"
./scripts/set-telegram-webhook.sh
```

## Docker (worker — tùy chọn)

```bash
docker build -t cic-telegram-openclaw .
docker run --env-file .env -p 8787:8787 cic-telegram-openclaw
```

Tuỳ chọn server thật: reverse proxy HTTPS → cổng 8787. **Local thì dùng tunnel** (mục trên), không cần Docker.

## Webhook Telegram

1. **Khuyến nghị — header secret:** `setWebhook` với `secret_token` trùng `TELEGRAM_WEBHOOK_SECRET`.

   - Worker trực tiếp: `POST https://<host>/telegram-webhook` (Telegram gửi kèm header).

2. **Qua Supabase Edge** `telegram-openclaw-proxy`:

   - `TELEGRAM_PROXY_SECRET` = cùng `secret_token` trong `setWebhook`
   - `OPENCLAW_WORKER_URL` = origin worker (`https://bot.example.com`)
   - URL webhook: `https://<ref>.supabase.co/functions/v1/telegram-openclaw-proxy`

3. **Legacy:** `POST https://<host>/webhook/<TELEGRAM_WEBHOOK_SECRET>`

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://<ref>.supabase.co/functions/v1/telegram-openclaw-proxy" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

## Lệnh chat

- `/help`, `/start`
- `/hopdong` — 30 dòng đầu (HTML)
- `/hopdong 2026-01-01 2026-12-31`
- `/hopdong_xlsx`, `/hopdong_docx` (+ tùy chọn 2 ngày ISO)

Với Ollama: câu tự nhiên (JSON tool) — `list_contracts` / `help`.

## Kiểm thử cục bộ

```bash
curl -s -X POST "http://127.0.0.1:8787/telegram-webhook" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"message":{"chat":{"id":123456789},"text":"/help"}}'
```

Thay `chat.id` bằng ID Telegram đã liên kết + verified trên ERP.
