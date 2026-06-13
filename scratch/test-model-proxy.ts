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

async function testModel(modelName: string) {
  console.log(`Testing model "${modelName}"...`);
  
  // Lấy key hoạt động đầu tiên từ DB để test trực tiếp
  const { data: keys } = await supabase
    .from('gemini_keys')
    .select('id, api_key')
    .eq('is_active', true)
    .limit(1);

  if (!keys || keys.length === 0) {
    console.error('❌ No active Gemini keys in DB to test.');
    return;
  }

  const apiKey = keys[0].api_key;
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

  try {
    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName.startsWith('models/') ? modelName : `models/${modelName}`,
        messages: [{ role: 'user', content: 'Ping connection test. Reply with exactly "pong"' }],
        temperature: 0.1,
        max_tokens: 5,
        stream: false
      })
    });

    const text = await res.text();
    console.log(`Result for ${modelName}: Status ${res.status}`);
    console.log(`Response: ${text.substring(0, 300)}`);
    console.log('--------------------------------------------');
  } catch (err: any) {
    console.error(`❌ Fetch error for ${modelName}:`, err.message);
  }
}

async function main() {
  // Test các model khác nhau
  await testModel('gemini-2.0-flash');
  await testModel('gemini-1.5-flash');
  await testModel('gemini-3.5-flash');
  await testModel('gemini-2.5-flash');
}

main();
