#!/bin/bash
echo "Bắt đầu tải các biến thể Gemma 4 (Ngầm lót ổ)..."
# Tải bản 31B (AWQ)
huggingface-cli download solidrust/gemma-2-27b-it-AWQ
# Tải bản 9B (AWQ) 
huggingface-cli download solidrust/gemma-2-9b-it-AWQ
echo "Tải xong tất cả!"
