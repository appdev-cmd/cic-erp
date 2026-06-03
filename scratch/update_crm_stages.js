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
    console.log("⚡ Đang cập nhật tên trạng thái 'Thất bại' thành 'Không tiềm năng' trong bảng crm_stage_templates...");
    
    const { data, error } = await supabase
        .from('crm_stage_templates')
        .update({ name: 'Không tiềm năng' })
        .eq('entity_type', 'lead')
        .eq('name', 'Thất bại')
        .select();
        
    if (error) {
        console.error("❌ Cập nhật thất bại:", error.message);
        process.exit(1);
    } else {
        console.log("✅ Cập nhật thành công!", data);
    }
}

run();
