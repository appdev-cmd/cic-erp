#!/bin/bash
echo "Kích hoạt Gemma 2 27B vLLM Offline..."
sudo docker rm -f vllm_server 2>/dev/null
sudo docker run -d --name vllm_server --gpus '"device=0"' \
    -e HUGGING_FACE_HUB_TOKEN=$HF_TOKEN \
    -e HF_HUB_OFFLINE=1 \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    --ipc=host \
    -p 8000:8000 \
    vllm/vllm-openai:latest \
    --model "unsloth/gemma-2-27b-it" \
    --gpu-memory-utilization 0.80 \
    --max-model-len 8192
echo "Gemma 2 27B Server Đã Kích Hoạt Offline Mode!"
