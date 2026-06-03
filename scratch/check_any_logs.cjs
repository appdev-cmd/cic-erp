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

const url = `${supabaseUrl}/rest/v1/ai_logs?select=id,success,created_at,model_id,input_preview,output_preview&limit=5`;

fetch(url, {
    headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
    }
})
.then(res => res.json())
.then(data => {
    console.log(`Tìm thấy ${data.length} logs bất kỳ:`);
    console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
