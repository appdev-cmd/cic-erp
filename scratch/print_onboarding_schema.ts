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
  console.log("=== KIỂM TRA SCHEMA CỦA CÁC BẢNG ===");
  const tables = ['onboarding_templates', 'onboarding_tasks', 'onboarding_checklists', 'onboarding_checklist_items'];
  
  // Since we are using anon key, we might not be able to directly query information_schema via postgrest 
  // unless there is an RPC. Let's try to query it.
  const { data, error } = await supabase
    .from('onboarding_templates')
    .select('*')
    .limit(0);
    
  if (error) {
    console.error("Error querying onboarding_templates:", error.message);
  } else {
    console.log("onboarding_templates query successful.");
  }
  
  // Let's try running a custom query or inspecting the model definitions.
  // Wait, let's write a query to information_schema if possible.
  // Since postgrest doesn't expose information_schema by default, let's look at what we can do.
  // We can try to insert a dummy record and see errors, or select keys from the returned object types if we can find them in the codebase.
  // Wait, we already have onboardingTypes.ts which has the TypeScript interfaces!
  // Let's compare onboardingTypes.ts with our service methods.
}

run();
