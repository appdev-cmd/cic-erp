# Worker trợ lý Telegram CIC (OpenClaw-style)

Điều phối **@cic_vn_bot**: xác thực qua RPC `telegram_bot_resolve_context`, báo cáo hợp đồng qua `telegram_bot_contracts_report`, xuất **Excel / DOCX**, tùy chọn **Gemma qua Ollama**.

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
