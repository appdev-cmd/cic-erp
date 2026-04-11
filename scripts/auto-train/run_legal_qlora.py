import os
import torch
import subprocess
from datasets import load_dataset
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments

# 1. Tự động ngắt tiến trình vLLM để giải phóng 100% VRAM 128GB
# Lưu ý: Sẽ tắt vLLM và các tiến trình AI phụ để tránh out-of-memory.
print("🛑 [1/5] Đang ngắt tạm thời vLLM Server để lấy toàn bộ 128GB VRAM...")
subprocess.run(["sudo", "docker", "stop", "vllm_server"], stderr=subprocess.DEVNULL)
print("✅ Đã giải phóng RAM!")

# os.environ["HF_HUB_OFFLINE"] = "1"

print("🚀 [2/5] Khởi động Unsloth Framework. Chuẩn bị Load Model Gemma 4 31B...")
max_seq_length = 4096 # Giữ vừa phải cho 31B + 128GB VRAM
dtype = None # Auto detected
load_in_4bit = True # 31B cần 4bit quantization để fit 128GB VRAM (31B bf16 = ~62GB + optimizer ~50GB = vượt quá)

try:
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = "unsloth/Qwen2.5-14B-Instruct", # Qwen 2.5 14B cực nhanh gọn và thông minh
        max_seq_length = max_seq_length,
        dtype = dtype,
        load_in_4bit = load_in_4bit,
        token = os.environ.get("HF_TOKEN")
    )

    # 2. Add LoRA Adapters (Chỉ train một lượng tạ nhỏ gắn thêm vào ruột, giữ nguyên độ thông minh cốt lõi)
    print("⚙️ [3/5] Đang chèn Adapter QLoRA vào Model...")
    model = FastLanguageModel.get_peft_model(
        model,
        r = 32, # Rank cao cho dữ liệu luật phức tạp
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                          "gate_proj", "up_proj", "down_proj",],
        lora_alpha = 32,
        lora_dropout = 0, # Tối ưu tốc độ
        bias = "none",    # Tối ưu tốc độ
        use_gradient_checkpointing = "unsloth", # Tối ưu VRAM
        random_state = 3407,
        use_rslora = False,
    )

    # 3. Load Dữ liệu Jsonl (Từ Teacher Llama 70B tạo ra)
    dataset_path = "dataset/legal_training_data.jsonl"
    if not os.path.exists(dataset_path):
        raise Exception(f"Không tìm thấy file {dataset_path}! Vui lòng chạy legal_data_generator.js trước.")
        
    print("📚 [4/5] Đang nạp giáo trình Pháp luật Xây dựng...")
    dataset = load_dataset("json", data_files=dataset_path, split="train")

    def format_prompts(examples):
        texts = []
        for messages in examples['messages']:
            # Dùng Qwen ChatML template
            text = f"<|im_start|>{messages[0]['role']}\n{messages[0]['content']}<|im_end|>\n<|im_start|>{messages[1]['role']}\n{messages[1]['content']}<|im_end|>\n<|im_start|>{messages[2]['role']}\n{messages[2]['content']}<|im_end|>"
            texts.append(text)
        return { "text" : texts }

    dataset = dataset.map(format_prompts, batched = True)

    # 4. Kích trần bộ máy huấn luyện
    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = dataset,
        dataset_text_field = "text",
        max_seq_length = max_seq_length,
        dataset_num_proc = 2,
        packing = False, # Vừa phải với máy 1 GPUGB10
        args = TrainingArguments(
            per_device_train_batch_size = 2, # 31B 4bit cần giảm batch size
            gradient_accumulation_steps = 8, # Bù lại bằng accumulation
            warmup_steps = 5,
            max_steps = 60, # Tăng tốc demo, thực tế nên đổi sang epoch
            # num_train_epochs = 3, 
            learning_rate = 2e-4,
            fp16 = not torch.cuda.is_bf16_supported(),
            bf16 = torch.cuda.is_bf16_supported(),
            logging_steps = 10,
            optim = "adamw_8bit",
            weight_decay = 0.01,
            lr_scheduler_type = "linear",
            seed = 3407,
            output_dir = "outputs_legal_qwen",
        ),
    )

    print("🔥 ĐANG LUYỆN MODEL... Vui lòng không tắt máy!")
    trainer_stats = trainer.train()

    # 5. Lưu kết quả đè về file cục bộ chạy luôn cho vLLM
    print("💾 [5/5] Xin chúc mừng! Đang lưu bộ não mới (Adapter)...")
    save_path = "lora_model/cic_legal_model"
    model.save_pretrained(save_path) # Chỉ lưu phần khôn thêm (lora) tránh tốn vài chục GB ổ cứng
    tokenizer.save_pretrained(save_path)
    
    print(f"🎉 Hoàn tất Auto-Trainer! Bộ năng nâng cấp đã được lưu tại {save_path}")
    print("🔄 Đang khởi động lại vLLM Server để áp dụng bộ não mới...")
    subprocess.run(["bash", "/home/cic-ai/cic-project/cic-erp/scripts/ai/vllm/start_legal_vllm.sh"])
    print("✨ vLLM Server Đã Lên!")

except Exception as e:
    print(f"❌ LỖI NGHIÊM TRỌNG TRONG QUÁ TRÌNH TRAIN: {e}")
    print("🔄 Cố gắng khôi phục lại vLLM Server vì lỗi...")
    subprocess.run(["bash", "/home/cic-ai/cic-project/cic-erp/scripts/ai/vllm/start_legal_vllm.sh"])
