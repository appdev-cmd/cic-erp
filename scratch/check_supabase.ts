import { createClient } from '@supabase/supabase-js';

const url = 'https://jyohocjsnsyfgfsmjfqx.supabase.co';
const anonKey = 'sb_publishable_qsfBWi9EC4HudNWcnY7A1Q_14li_aL9';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2hvY2pzbnN5Zmdmc21qZnF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQxMTE4MywiZXhwIjoyMDg0OTg3MTgzfQ.7r3xY99EiPXiIFh6K7ctR8Xw05NJT0pwJVn0cQrPxyU';

async function testConnection(name: string, key: string) {
  const supabase = createClient(url, key);
  console.log(`\n--- Testing connection for: ${name} ---`);
  try {
    const { data, error } = await supabase.from('contracts').select('id').limit(3);
    if (error) {
      console.error(`[${name}] Error:`, error.message, error.details, error.hint);
    } else {
      console.log(`[${name}] Success! Retrieved ${data?.length} rows.`);
    }
  } catch (e: any) {
    console.error(`[${name}] Exception:`, e.message);
  }
}

async function run() {
  await testConnection('Anon Key (Publishable)', anonKey);
  await testConnection('Service Role Key', serviceRoleKey);
}

run();
