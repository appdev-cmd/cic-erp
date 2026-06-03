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

// Truy vấn các hợp đồng năm 2026
const url = `${supabaseUrl}/rest/v1/contracts?select=id,title,contract_code,party_a,value,signed_date,unit_id&signed_date=gte.2026-01-01&signed_date=lte.2026-12-31`;

fetch(url, {
    headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
    }
})
.then(res => res.json())
.then(data => {
    console.log(`Tìm thấy ${data.length} hợp đồng năm 2026 trong DB:`);
    console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
