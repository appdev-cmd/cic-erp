#!/bin/bash
export HF_HOME=/home/cic-ai/.cache/huggingface
/usr/local/bin/vllm serve unsloth/gemma-2-9b-it --port 8001 --gpu-memory-utilization 0.3 --max-model-len 8192
