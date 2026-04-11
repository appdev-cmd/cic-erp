#!/bin/bash
echo "🚀 Khởi động vLLM Server (Cụm 2) với mô hình Gemma 4 26B..."

# Xóa tiến trình Docker vllm cũ nếu có
sudo docker rm -f vllm_server_2 2>/dev/null

# Khởi chạy Docker container vLLM
sudo docker run -d --name vllm_server_2 --gpus '"device=0"' \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --ipc=host \
    -p 8001:8000 \
    --entrypoint /bin/bash \
    vllm/vllm-openai:latest \
    -c "apt-get update && apt-get install -y git && pip install git+https://github.com/huggingface/transformers.git && vllm serve google/gemma-4-26B-A4B-it --served-model-name gemma-4-26b --gpu-memory-utilization 0.70 --max-model-len 32768 --enable-auto-tool-choice --tool-call-parser hermes"

echo "----------------------------------------------------"
echo "🌟 vLLM Cụm 2 (Gemma-4-26B) đang khởi động trong Docker: 'vllm_server_2'"
echo "📍 Cổng giao tiếp: localhost:8001"
echo "----------------------------------------------------"
echo "Để xem tiến trình: sudo docker logs -f vllm_server_2"
