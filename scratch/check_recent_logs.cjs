const fs = require('fs');
const path = require('path');

let supabaseUrl = '';
let supabaseKey = '';

try {
    const envPath = path.join(__dirname, '..', '.env.local');
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
    console.error("Không tìm thấy Supabase URL hoặc Key!");
    process.exit(1);
}

// Thử query 5 logs mới nhất mà không order by created_at (để tránh timeout nếu thiếu index)
// Hoặc order theo created_at nhưng giới hạn thời gian trong hôm nay
const today = new Date().toISOString().split('T')[0];
const url = `${supabaseUrl}/rest/v1/ai_logs?select=id,success,error_message,created_at,model_id,action_type,input_preview,output_preview&created_at=gte.${today}&limit=5`;

console.log("Truy vấn URL:", url);

fetch(url, {
    method: 'GET',
    headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
    }
})
.then(res => res.json())
.then(data => {
    console.log(`Tìm thấy ${data.length} logs trong ngày hôm nay:`);
    data.forEach((log, index) => {
        console.log(`\n--- [LOG ${index + 1}] ---`);
        console.log(`ID: ${log.id}`);
        console.log(`Thời gian: ${log.created_at}`);
        console.log(`Mô hình: ${log.model_id}`);
        console.log(`Câu hỏi: ${log.input_preview}`);
        console.log(`Câu trả lời: ${log.output_preview}`);
    });
})
.catch(err => {
    console.error("Lỗi:", err.message);
});
