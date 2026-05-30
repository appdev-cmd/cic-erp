const fs = require('fs');
const path = require('path');

// Đọc .env.local để lấy khóa và URL
function loadEnv() {
  const env = {};
  try {
    const envPath = path.resolve('.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim();
            env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    console.error('Không thể đọc file .env.local:', err.message);
  }
  return env;
}

const env = loadEnv();
const apiKey = env.VITE_LITELLM_KEY || 'sk-cic-2026';
const baseURL = 'https://ai-api.cic.com.vn:9443/v1';

async function checkModels() {
  console.log('=== BẮT ĐẦU KIỂM TRA MÁY CHỦ QWEN / AI ===');
  console.log(`Base URL: ${baseURL}`);
  console.log(`API Key: ${apiKey.substring(0, 6)}...`);

  // 1. Kiểm tra danh sách model đang hoạt động
  console.log('\n1. Đang truy vấn danh sách mô hình online từ /models...');
  try {
    const res = await fetch(`${baseURL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    console.log(`HTTP Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log('Các mô hình có sẵn trên server:');
      if (data && data.data) {
        data.data.forEach((m, idx) => {
          console.log(`   [${idx + 1}] ID: ${m.id} | Owned by: ${m.owned_by || 'N/A'}`);
        });
      } else {
        console.log('Phản hồi không chứa danh sách data:', JSON.stringify(data));
      }
    } else {
      const text = await res.text();
      console.log(`Lỗi khi lấy danh sách models: ${text}`);
    }
  } catch (err) {
    console.error('Không thể kết nối tới server /models:', err.message);
  }

  // 2. Test chat completion cho từng model Qwen thông dụng
  const modelsToTest = ['qwen2.5-32b', 'qwen2.5-72b', 'qwen2.5-7b', 'qwen2.5-vl-7b', 'qwen3.5-27b', 'gemma-4-26b'];
  console.log('\n2. Đang kiểm tra chat completion cho các mô hình...');

  for (const model of modelsToTest) {
    console.log(`\n--> Thử nghiệm mô hình: [${model}]...`);
    const start = Date.now();
    try {
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hãy trả lời ngắn gọn: Ping!' }],
          max_tokens: 30,
          temperature: 0.15
        })
      });

      const latency = Date.now() - start;
      console.log(`   HTTP Status: ${res.status} (Thời gian phản hồi: ${latency}ms)`);
      if (res.ok) {
        const data = await res.json();
        const reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : 'Không có câu trả lời';
        console.log(`   ✅ THÀNH CÔNG!`);
        console.log(`   Phản hồi: "${reply.trim()}"`);
      } else {
        const errText = await res.text();
        console.log(`   ❌ LỖI: ${errText.substring(0, 200)}`);
      }
    } catch (err) {
      console.log(`   ❌ LỖI KẾT NỐI: ${err.message}`);
    }
  }
}

checkModels();
