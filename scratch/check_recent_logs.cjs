const fs = require('fs');
const path = require('path');

let supabaseUrl = '';
let supabaseKey = '';

try {
    const envPath = path.join(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
                supabaseUrl = trimmed.split('=')[1].replace(/['"]/g, '').trim();
            }
            if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
                supabaseKey = trimmed.split('=')[1].replace(/['"]/g, '').trim();
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

// Lấy 3 logs gần nhất, sắp xếp theo thời gian giảm dần
const url = `${supabaseUrl}/rest/v1/ai_logs?select=id,success,error_message,created_at,model_id,action_type,input_preview,output_preview,metadata&order=created_at.desc&limit=3`;

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
    console.log(`Thành công! Tìm thấy ${data.length} logs gần nhất.`);
    data.forEach((log, index) => {
        console.log(`\n--- [LOG ${index + 1}] ---`);
        console.log(`ID: ${log.id}`);
        console.log(`Thời gian: ${log.created_at}`);
        console.log(`Mô hình: ${log.model_id}`);
        console.log(`Thành công: ${log.success}`);
        console.log(`Câu hỏi: ${log.input_preview}`);
        console.log(`Câu trả lời: ${log.output_preview}`);
        console.log(`Metadata:`, JSON.stringify(log.metadata, null, 2));
        console.log(`Lỗi: ${log.error_message}`);
    });
})
.catch(err => {
    console.error("Lỗi truy vấn:", err.message);
});
