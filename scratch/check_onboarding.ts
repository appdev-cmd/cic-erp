import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env.local manually
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, ''); // strip quotes
        if (key === 'VITE_SUPABASE_URL') supabaseUrl = value;
        if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value;
      }
    }
  }
} catch (e) {
  console.error("Failed to read .env.local:", e);
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== KIỂM TRA BẢNG ONBOARDING ===");
  const tables = ['onboarding_templates', 'onboarding_tasks', 'onboarding_checklists', 'onboarding_checklist_items'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Bảng ${table}: CHƯA TỒN TẠI HOẶC LỖI:`, error.message);
    } else {
      console.log(`Bảng ${table}: ĐÃ TỒN TẠI (số dòng trong DB: ${data?.length || 0})`);
    }
  }
}

run();
