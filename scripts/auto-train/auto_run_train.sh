#!/bin/bash
echo "Đang đợi vLLM Server Llama 70B nạp dữ liệu (Có thể mất 2-5 phút)..."
while ! curl -s http://127.0.0.1:8000/v1/models > /dev/null; do
    sleep 5
done
echo "vLLM đã sẵn sàng! Kích kích train.sh..."
cd /home/cic-ai/cic-project/cic-erp/scripts/auto-train
bash train.sh > train_run.log 2>&1
echo "Toàn bộ tiến trình train kết thúc."
