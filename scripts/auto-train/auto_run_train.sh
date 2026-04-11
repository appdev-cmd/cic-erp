#!/bin/bash
echo "Đang đợi vLLM Server nạp dữ liệu (Có thể mất 2-5 phút)..."
while ! curl -s -H "Authorization: Bearer cic-local-2026" http://127.0.0.1:8000/v1/models | grep -q "id"; do
    sleep 5
done
echo "vLLM đã hoàn tất tải checkpoint! Kích hoạt train.sh..."
cd /home/cic-ai/cic-project/cic-erp/scripts/auto-train
bash train.sh > train_run.log 2>&1
echo "Toàn bộ tiến trình train kết thúc."
