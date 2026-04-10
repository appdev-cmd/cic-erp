#!/bin/bash
# Script tự động hóa toàn bộ quá trình: Chưng cất dữ liệu -> Luyện Model

echo "============================================="
echo "🛠️ CIC ERP - AUTO TRAINER PIPELINE "
echo "============================================="

cd /home/cic-ai/cic-project/cic-erp/scripts/auto-train
export HF_TOKEN="<YOUR_HF_TOKEN>"

# 1. Bóc tách PDF/DOCX thành JSONL
echo -e "\n[GIAI ĐOẠN 1] Khởi Động Llama 70B bóc tách Văn bản Pháp luật..."
node legal_data_generator.js

echo -e "\n[GIAI ĐOẠN 1B] Hấp thụ truy vấn tương tác từ Database ERP..."
node db_query_generator.js

if [ $? -ne 0 ]; then
    echo "❌ Lỗi ở giai đoạn bóc dữ liệu!"
    exit 1
fi

# 2. Huấn luyện SFT
echo -e "\n[GIAI ĐOẠN 2] Ngắt vLLM & Bắt đầu Fine-Tuning Qwen 3.5..."
sudo docker rm -f vllm_server

if [ ! -d "venv" ]; then
    echo "Đang tạo môi trường ảo Python và cài đặt PyTorch, Unsloth..."
    python3 -m venv venv
    source venv/bin/activate
    pip install torch transformers trl unsloth datasets accelerate
else
    source venv/bin/activate
fi

python3 run_legal_qlora.py

echo -e "\n============================================="
echo "🎉 HOÀN THÀNH QUY TRÌNH HUẤN LUYỆN!"
echo "Model của bạn đã học xong toàn bộ Pháp luật Xây dựng."
echo "============================================="
