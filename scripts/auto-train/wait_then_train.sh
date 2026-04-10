#!/bin/bash
cd /home/cic-ai/cic-project/cic-erp/scripts/auto-train

echo "[STEP 1] Chờ tải model..."
while pgrep -f "snapshot_download" > /dev/null; do
    echo "Tiến trình tải vẫn đang chạy. Đợi tiếp..."
    sleep 60
done
echo "✅ Đã tải xong toàn bộ model Gemma 4!"

echo "[STEP 2] Khởi động người thầy vLLM (Llama 3.1 70B)..."
sudo docker rm -f vllm_server
sudo docker run -d --name vllm_server \
  --gpus all \
  --ipc=host \
  --restart always \
  -e HF_TOKEN="<YOUR_HF_TOKEN>" \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4 \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 8192 \
  --enforce-eager \
  --dtype float16 \
  --quantization awq \
  --gpu-memory-utilization 0.80 \
  --api-key empty \
  --served-model-name "hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4"

echo "[STEP 3] Đợi vLLM khởi động xong..."
while ! curl -s http://127.0.0.1:8000/v1/models > /dev/null; do
    echo "Chưa kết nối được vLLM, chờ 10s..."
    sleep 10
done
echo "✅ vLLM Teacher đã sẵn sàng!"

echo "[STEP 4] Bắt đầu Train Pipeline!"
bash train.sh > final_train_run.log 2>&1

echo "🎉 Toàn bộ quy trình Train đã kết thúc!"
