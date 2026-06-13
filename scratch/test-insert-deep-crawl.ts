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
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Testing insert deep_crawl source...');
  const { data, error } = await supabase.from('tech_sources').insert([
    {
      name: 'Test Deep Crawl Source',
      url: 'https://example.com/test-deep-crawl-url',
      type: 'deep_crawl',
      language: 'en',
      country: 'US',
      category: 'contech',
      is_active: false,
    }
  ]).select();

  if (error) {
    console.error('❌ Insert failed:', error.message);
  } else {
    console.log('✅ Insert successful! Created ID:', data[0].id);
    // Clean up
    await supabase.from('tech_sources').delete().eq('id', data[0].id);
    console.log('✅ Deleted test source.');
  }
}

main();
