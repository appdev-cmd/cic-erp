#!/bin/bash
echo "🚀 Khởi động vLLM Server (Cụm 1) với mô hình Qwen 2.5 32B..."

# Xóa tiến trình Docker vllm cũ nếu có
sudo docker rm -f vllm_server_1 2>/dev/null

# Khởi chạy Docker container vLLM
sudo docker run -d --name vllm_server_1 --gpus '"device=0"' \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --ipc=host \
    -p 8000:8000 \
    vllm/vllm-openai:latest \
    --model "Qwen/Qwen2.5-32B-Instruct-AWQ" \
    --served-model-name "qwen2.5-32b" \
    --quantization awq \
    --gpu-memory-utilization 0.90 \
    --max-model-len 32768 \
    --enable-auto-tool-choice \
    --tool-call-parser hermes

echo "----------------------------------------------------"
echo "🌟 vLLM Cụm 1 (Qwen 2.5 32B) đang khởi động trong Docker: 'vllm_server_1'"
echo "📍 Cổng giao tiếp: localhost:8000"
echo "----------------------------------------------------"
echo "Để xem tiến trình: sudo docker logs -f vllm_server_1"

