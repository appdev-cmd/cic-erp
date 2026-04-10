#!/bin/bash
echo "🚀 Khởi động vLLM Server: Qwen2.5-14B-Instruct + Pháp Luật LoRA..."

# Dọn dẹp container vllm_server đang bị kẹt
sudo docker rm -f vllm_server 2>/dev/null

# Khởi chạy Docker container cho Model Pháp Luật
# SỬA LỖI TREO: Đã nới rộng --ipc=host để PyTorch không bị Deadlock bộ nhớ dùng chung.
sudo docker run -d --name vllm_server --gpus '"device=0"' \
    -e HUGGING_FACE_HUB_TOKEN=$HF_TOKEN \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    -v /home/cic-ai/cic-project/cic-erp/scripts/auto-train/lora_model:/model_lora \
    --ipc=host \
    -p 8000:8000 \
    vllm/vllm-openai:latest \
    --model "unsloth/Qwen2.5-14B-Instruct" \
    --served-model-name "cic-legal-14b" \
    --gpu-memory-utilization 0.85 \
    --max-model-len 8192 \
    --enforce-eager \
    --enable-lora \
    --max-lora-rank 32 \
    --lora-modules "cic-legal-14b=/model_lora/cic_legal_model" \
    --api-key "cic-local-2026"

echo "----------------------------------------------------"
echo "⚖️ vLLM (Qwen 14B Legal LoRA) đang khởi động..."
echo "✅ Đã sửa lỗi treo Crash (Thêm quyền Share Memory ipc=host)"
echo "----------------------------------------------------"
echo "Để theo dõi xem nó đã nạp xong chưa: sudo docker logs -f vllm_server"
