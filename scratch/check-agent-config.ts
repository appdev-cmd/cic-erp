import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Manual env loading
function loadEnv(p: string) {
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) {
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch { /* ignore */ }
}
loadEnv('.env');
loadEnv('.env.local');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking agent_configs for agent-contech...');
  const { data, error } = await supabase
    .from('agent_configs')
    .select('*')
    .eq('id', 'agent-contech')
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log('✅ Found config:', data);
  }
}

main();
