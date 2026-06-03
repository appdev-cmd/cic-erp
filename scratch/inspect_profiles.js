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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log("Supabase URL:", env.VITE_SUPABASE_URL);
  
  // 1. Fetch profiles
  const { data: profiles, error: pError } = await supabase.from('profiles').select('id, email, role, unit_id');
  if (pError) {
    console.error("Lỗi lấy profiles:", pError);
  } else {
    console.log("=== DANH SÁCH PROFILES ===");
    console.log(profiles);
  }

  // 2. Fetch units
  const { data: units, error: uError } = await supabase.from('units').select('id, name, code');
  if (uError) {
    console.error("Lỗi lấy units:", uError);
  } else {
    console.log("=== DANH SÁCH UNITS ===");
    console.log(units);
  }
}

run();
