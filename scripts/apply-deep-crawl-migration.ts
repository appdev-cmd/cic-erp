import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_SERVICE_ROLE_KEY trong .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('📦 Applying Deep Crawl source type migration...\n');

  const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260614_add_deep_crawl_source_type.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log(`  Reading SQL migration: ${sqlPath}`);
  
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.warn('⚠️  RPC exec_sql failed, trying direct REST post...', error.message);
    
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Failed to apply migration: ${res.status} - ${text}`);
      process.exit(1);
    } else {
      console.log('✅ Migration applied successfully via REST!');
    }
  } else {
    console.log('✅ Migration applied successfully via RPC!');
  }
}

main().catch(console.error);
