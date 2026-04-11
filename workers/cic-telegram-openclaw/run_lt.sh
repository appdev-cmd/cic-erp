#!/bin/bash
source .env
npx localtunnel --port 8787 --bypass-tunnel-reminder > lt.log &
sleep 5
URL=$(grep -o "https://.*" lt.log)
echo "Tunnel URL: $URL"
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -F "url=${URL}/telegram-webhook" \
  -F "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
echo ""
