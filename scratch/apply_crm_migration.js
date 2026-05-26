const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manual env loading
const loadEnv = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
    });
};

loadEnv(path.resolve(process.cwd(), '.env'));
loadEnv(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Thiếu VITE_SUPABASE_URL hoặc Key trong môi trường.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260523160600_create_crm_schema.sql');
    if (!fs.existsSync(migrationPath)) {
        console.error("❌ Không tìm thấy file migration tại:", migrationPath);
        process.exit(1);
    }

    console.log("📖 Đang đọc file migration...");
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log("⚡ Đang gửi câu lệnh SQL tới Supabase qua RPC 'execute_sql'...");
    
    // Vì execute_sql RPC thực thi toàn bộ đoạn SQL một lúc
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    
    if (error) {
        console.error("❌ Áp dụng Migration thất bại:", error.message);
        if (error.details) console.error("Chi tiết:", error.details);
        if (error.hint) console.error("Gợi ý:", error.hint);
        process.exit(1);
    } else {
        console.log("✅ Áp dụng Migration thành công!");
        console.log("Kết quả:", data);
    }
}

run();
