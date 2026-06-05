import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
        const value = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key === 'VITE_SUPABASE_URL') supabaseUrl = value;
        if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value;
      }
    }
  }
} catch (e) {
  console.error("Failed to read .env.local:", e);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== KIỂM TRA RLS POLICIES ===");
  // Query pg_policies via RPC or general query
  // Since we don't have a direct sql runner RPC, we can query public tables to see if we can do CRUD.
  // Let's test insert on onboarding_templates
  const { data, error } = await supabase.from('onboarding_templates').insert({
    name: 'Test Template Policy Check',
    is_default: false
  }).select();

  if (error) {
    console.log("Insert failed on onboarding_templates:", error.message);
  } else {
    console.log("Insert succeeded on onboarding_templates:", data);
    // Cleanup
    if (data && data[0]?.id) {
      await supabase.from('onboarding_templates').delete().eq('id', data[0].id);
      console.log("Cleaned up test template.");
    }
  }
}

run();
