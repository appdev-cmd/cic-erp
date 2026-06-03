import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log("Supabase URL:", process.env.VITE_SUPABASE_URL);
  
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
