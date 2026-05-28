const fs = require('fs');
const path = require('path');

// Đọc file .env.local để lấy credentials
let supabaseUrl = '';
let supabaseKey = '';

try {
    const envPath = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
                supabaseUrl = trimmed.split('=')[1].replace(/['"]/g, '');
            }
            if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
                supabaseKey = trimmed.split('=')[1].replace(/['"]/g, '');
            }
        }
    }
} catch (e) {
    console.error("Lỗi khi đọc file .env.local:", e.message);
}

if (!supabaseUrl || !supabaseKey) {
    console.error("Không tìm thấy Supabase URL hoặc Key trong .env.local!");
    process.exit(1);
}

console.log("Supabase URL:", supabaseUrl);
console.log("Đang truy vấn Supabase REST API...");

const url = `${supabaseUrl}/rest/v1/ai_logs?select=*&order=created_at.desc&limit=10`;

fetch(url, {
    method: 'GET',
    headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
    }
})
.then(res => {
    if (!res.ok) {
        return res.text().then(err => { throw new Error(`HTTP ${res.status}: ${err}`); });
    }
    return res.json();
})
.then(data => {
    console.log(`Thành công! Tìm thấy ${data.length} logs.`);
    data.forEach((log, index) => {
        console.log(`\n--- [LOG ${index + 1}] ---`);
        console.log(`Thời gian: ${log.created_at}`);
        console.log(`Mô hình: ${log.model_id}`);
        console.log(`Chế độ: ${log.action_type}`);
        console.log(`Thành công: ${log.success}`);
        console.log(`Độ trễ: ${log.latency_ms}ms`);
        console.log(`Câu hỏi: ${log.input_preview}`);
        console.log(`Câu trả lời: ${log.output_preview}`);
        console.log(`Thông báo lỗi: ${log.error_message}`);
    });
})
.catch(err => {
    console.error("Lỗi truy vấn:", err.message);
});
