const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Tự parse file .env.local
const env = {};
const parseEnvFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
};
parseEnvFile(path.join(__dirname, '..', '.env.local'));

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = env['VITE_DEV_EMAIL'] || 'appdev@cic.com.vn';
  const password = env['VITE_DEV_PASSWORD'] || 'Abc123456';
  await supabase.auth.signInWithPassword({ email, password });
  
  // Lấy 1 bản ghi bất kỳ từ bảng contracts
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error("Lỗi:", error);
    return;
  }
  
  if (contracts.length > 0) {
    console.log("Danh sách các cột trong bảng contracts:");
    console.log(Object.keys(contracts[0]).sort());
    console.log("\nDữ liệu mẫu 1 bản ghi:");
    console.log(JSON.stringify(contracts[0], null, 2));
  } else {
    console.log("Không tìm thấy hợp đồng nào.");
  }
}

run();
