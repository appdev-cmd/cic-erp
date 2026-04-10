#!/bin/bash
echo "Bắt đầu tải các biến thể Llama 4 (Ngầm lót ổ)..."
# Tải bản 8B (AWQ)
huggingface-cli download solidrust/Meta-Llama-3.1-8B-Instruct-AWQ
# Tải bản 70B (AWQ) (Giả sử máy chủ gánh được)
# huggingface-cli download solidrust/Meta-Llama-3.1-70B-Instruct-AWQ
echo "Tải xong Llama 4!"
