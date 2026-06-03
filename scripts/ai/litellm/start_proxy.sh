#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "🚀 Kích hoạt mạng lưới LiteLLM Proxy Gateway..."
sudo docker rm -f litellm_proxy 2>/dev/null

sudo docker run -d \
    --name litellm_proxy \
    --network host \
    -e LITELLM_MASTER_KEY="sk-cic-2026" \
    -e LITELLM_LOG="DEBUG" \
    -v "${SCRIPT_DIR}/config.yaml:/app/config.yaml:ro" \
    ghcr.io/berriai/litellm:main-latest \
    --config /app/config.yaml --port 4000

echo "✅ LiteLLM đang chạy ngầm trên Docker (Container: 'litellm_proxy')."
echo "🌐 Proxy phục vụ tại cổng: 4000 (Chuyển tiếp cho vLLM tại 8000)."
