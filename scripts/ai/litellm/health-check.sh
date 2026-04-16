#!/bin/bash
# AI Proxy Health Check

LOG_FILE="/var/log/ai-proxy-health.log"
ENDPOINT="http://localhost:4000/health"

if ! command -v curl &> /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - ERROR - curl is not installed" >> "$LOG_FILE"
    exit 1
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$ENDPOINT")

if [ "$HTTP_CODE" -ne 200 ] && [ "$HTTP_CODE" -ne 404 ] && [ "$HTTP_CODE" -ne 405 ] && [ "$HTTP_CODE" -ne 401 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - WARNING - LiteLLM proxy is not responsive (HTTP $HTTP_CODE). Restarting..." >> "$LOG_FILE"
    # Restart the proxy (assuming it's a systemd service or pm2)
    # pm2 restart litellm || systemctl restart litellm
    # For now, let's log the failure. If there's a specific restart command, we use it.
    pm2 restart litellm_proxy || pkill -f litellm
    sleep 2
    /home/cic-ai/cic-project/cic-erp/scripts/ai/litellm/start_proxy.sh >> /var/log/litellm_restart.log 2>&1 &
    echo "$(date '+%Y-%m-%d %H:%M:%S') - INFO - Restart command issued." >> "$LOG_FILE"
else
    # Only log success occasionally or omit to save disk space
    echo "$(date '+%Y-%m-%d %H:%M:%S') - OK - Proxy is running (HTTP $HTTP_CODE)" >> "$LOG_FILE"
fi
