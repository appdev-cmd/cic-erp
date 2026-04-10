#!/bin/bash
echo "Bắt đầu tải Llama 4 70B (Hạng nặng - Flagship)..."
# Tải bản 70B (AWQ)
huggingface-cli download casperhansen/llama-3.1-70b-instruct-awq
echo "Tải xong Llama 4 70B!"
