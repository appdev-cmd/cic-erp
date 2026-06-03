const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envLocal = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envLocal.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2hvY2pzbnN5Zmdmc21qZnF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQxMTE4MywiZXhwIjoyMDg0OTg3MTgzfQ.7r3xY99EiPXiIFh6K7ctR8Xw05NJT0pwJVn0cQrPxyU';
const supabase = createClient(env.VITE_SUPABASE_URL, serviceRoleKey);

async function run() {
  console.log("Supabase URL:", env.VITE_SUPABASE_URL);
  
  // 1. Update appdev@cic.com.vn profile to role = 'Leadership'
  console.log("Updating appdev@cic.com.vn role to Leadership...");
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'Leadership' })
    .eq('id', '4fda6e7a-a8f7-4efd-a8cd-021a3e7e67c5')
    .select();
    
  if (error) {
    console.error("Lỗi cập nhật role:", error);
  } else {
    console.log("Cập nhật thành công:", data);
  }
}

run();
