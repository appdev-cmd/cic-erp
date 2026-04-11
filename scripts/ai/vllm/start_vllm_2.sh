#!/bin/bash
echo "🚀 Khởi động vLLM Server (Cụm 2) với mô hình Qwen 3.5 27B..."

# Xóa tiến trình Docker vllm cũ nếu có
sudo docker rm -f vllm_server_2 2>/dev/null

# Khởi chạy Docker container vLLM
sudo docker run -d --name vllm_server_2 --gpus '"device=0"' \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --ipc=host \
    -p 8001:8000 \
    vllm/vllm-openai:latest \
    --model "Qwen/Qwen3.5-27B-Instruct-AWQ" \
    --served-model-name "qwen3.5-27b" \
    --quantization awq \
    --gpu-memory-utilization 0.90 \
    --max-model-len 8192 \
    --enable-auto-tool-choice \
    --tool-call-parser hermes

echo "----------------------------------------------------"
echo "🌟 vLLM Cụm 2 (Qwen 3.5 27B) đang khởi động trong Docker: 'vllm_server_2'"
echo "📍 Cổng giao tiếp: localhost:8001"
echo "----------------------------------------------------"
echo "Để xem tiến trình: sudo docker logs -f vllm_server_2"
