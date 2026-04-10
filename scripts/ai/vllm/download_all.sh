#!/bin/bash
export HF_TOKEN="<YOUR_HF_TOKEN>"

echo "Bắt đầu tải các models..."

models=(
    "hugging-quants/Meta-Llama-3.1-70B-Instruct-AWQ-INT4"
    "unsloth/gemma-2-27b-it"
    "hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4"
    "unsloth/gemma-2-9b-it"
)

for model in "${models[@]}"; do
    echo "Đang tải $model..."
    python3 -c "from huggingface_hub import snapshot_download; snapshot_download('$model')"
    echo "Hoàn tất $model"
done

echo "Tất cả model đã được tải thành công."
