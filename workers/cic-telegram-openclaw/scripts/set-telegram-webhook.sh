#!/usr/bin/env bash
# Gọi setWebhook cho @cic_vn_bot — chạy SAU KHI đã:
# - Edge secrets: TELEGRAM_PROXY_SECRET, OPENCLAW_WORKER_URL
# - Worker chạy HTTPS và TELEGRAM_WEBHOOK_SECRET = cùng TELEGRAM_PROXY_SECRET
#
# Cách dùng:
#   export TELEGRAM_BOT_TOKEN="..."
#   export TELEGRAM_WEBHOOK_SECRET="..."   # cùng giá trị TELEGRAM_PROXY_SECRET trên Supabase
#   export SUPABASE_FUNCTIONS_URL="https://<ref>.supabase.co/functions/v1/telegram-openclaw-proxy"
#   ./scripts/set-telegram-webhook.sh

set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?Thiếu TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_WEBHOOK_SECRET:?Thiếu TELEGRAM_WEBHOOK_SECRET (đặt trùng TELEGRAM_PROXY_SECRET)}"
: "${SUPABASE_FUNCTIONS_URL:?Thiếu SUPABASE_FUNCTIONS_URL (URL đầy đủ tới telegram-openclaw-proxy)}"

resp="$(curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${SUPABASE_FUNCTIONS_URL}" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}")"

echo "$resp" | head -c 2000
echo ""

if echo "$resp" | grep -q '"ok":true'; then
  echo "OK: webhook đã cập nhật."
else
  echo "Lỗi: kiểm tra token và URL." >&2
  exit 1
fi
