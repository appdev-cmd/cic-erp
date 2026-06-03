const fs = require('fs');
const path = require('path');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = value;
    }
  });
  return env;
}

async function testSupabase(env, name) {
  console.log(`\n--- Testing config from: ${name} ---`);
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  console.log(`URL: ${url}`);
  console.log(`Key (first 20 chars): ${key ? key.substring(0, 20) : 'undefined'}...`);

  if (!url || !key) {
    console.log('Missing URL or Key');
    return;
  }

  try {
    const res = await fetch(`${url}/rest/v1/contracts?select=id,title,value,signed_date,status&limit=5`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`Success! Found ${data.length} contracts.`);
      console.log('Sample data:', JSON.stringify(data, null, 2));
    } else {
      const text = await res.text();
      console.log(`Error body: ${text}`);
    }
  } catch (err) {
    console.error(`Fetch failed for ${name}:`, err);
  }
}

async function run() {
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envDocPath = path.join(__dirname, '..', 'doc_2026-06-03_07-37-59.env.local');

  const envLocal = parseEnv(envLocalPath);
  if (envLocal) {
    await testSupabase(envLocal, '.env.local');
  }

  const envDoc = parseEnv(envDocPath);
  if (envDoc) {
    await testSupabase(envDoc, 'doc_2026-06-03_07-37-59.env.local');
  }
}

run();
