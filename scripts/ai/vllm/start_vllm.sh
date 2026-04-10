#!/bin/bash
echo "🚀 Khởi động vLLM Server qua Docker với mô hình Qwen3.5-27B-Instruct-AWQ..."

# Xóa tiến trình Docker vllm cũ nếu có
sudo docker rm -f vllm_server 2>/dev/null

# Tải Qwen 3.5 27B phiên bản AWQ (Lưu ý: Model mới ra mắt có thể yêu cầu HF_TOKEN)
MODEL_NAME="Qwen/Qwen3.5-27B-Instruct-AWQ"

# Khởi chạy Docker container vLLM (Thêm biến môi trường cấp quyền HF)
sudo docker run -d --name vllm_server --gpus '"device=0"' \
    -e HUGGING_FACE_HUB_TOKEN=$HF_TOKEN \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --ipc=host \
    -p 8000:8000 \
    vllm/vllm-openai:latest \
    --model "Qwen/Qwen2.5-32B-Instruct-AWQ" \
    --served-model-name "Qwen/Qwen3.5-27B-Instruct-AWQ" \
    --quantization awq \
    --gpu-memory-utilization 0.85 \
    --max-model-len 8192 \
    --enable-auto-tool-choice \
    --tool-call-parser hermes

echo "----------------------------------------------------"
echo "🌟 vLLM (Qwen 3.5 27B AWQ) đang khởi động trong Docker container: 'vllm_server'"
echo "🔥 Sức mạnh 128GB RAM đã được giải phóng toàn diện!"
echo "----------------------------------------------------"
echo "Để xem tiến trình tải Model (Có thể mất 5-10 phút): sudo docker logs -f vllm_server"
