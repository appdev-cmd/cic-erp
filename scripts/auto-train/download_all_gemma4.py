#!/usr/bin/env python3
"""
Tải toàn bộ dòng Gemma 4 instruction-tuned về cache local.
Chạy: nohup python3 download_all_gemma4.py > download_all.log 2>&1 &
"""
import os
import time
from huggingface_hub import snapshot_download

TOKEN = os.environ.get("HF_TOKEN", "<YOUR_HF_TOKEN>")

MODELS = [
    "google/gemma-4-26B-A4B-it", 
    "google/gemma-4-E4B-it",      
    "google/gemma-4-E2B-it",       
]

for model_id in MODELS:
    print(f"\n{'='*60}")
    print(f"🚀 Bắt đầu tải: {model_id}")
    print(f"{'='*60}")
    start = time.time()
    try:
        path = snapshot_download(
            repo_id=model_id,
            token=TOKEN,
            resume_download=True
        )
        elapsed = (time.time() - start) / 60
        print(f"✅ Tải xong {model_id} trong {elapsed:.1f} phút")
        print(f"   Lưu tại: {path}")
    except Exception as e:
        print(f"❌ Lỗi tải {model_id}: {e}")
        print("   Thử model tiếp theo...")
        continue

print(f"\n{'='*60}")
print("🎉 Hoàn tất tải tất cả model Gemma 4!")
print(f"{'='*60}")
