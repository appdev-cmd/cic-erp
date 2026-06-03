const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

async function run() {
  const envDocPath = path.join(__dirname, '..', 'doc_2026-06-03_07-37-59.env.local');
  const env = parseEnv(envDocPath);
  if (!env) {
    console.log('Could not load env doc.');
    return;
  }

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  const email = env.VITE_DEV_EMAIL;
  const password = env.VITE_DEV_PASSWORD;

  console.log(`URL: ${url}`);
  console.log(`Key (first 20): ${key ? key.substring(0, 20) : 'undefined'}...`);
  console.log(`Email: ${email}`);

  // We need to require supabase-js
  // Let's see if we can do auth manually via Fetch to avoid importing @supabase/supabase-js
  // Supabase Auth endpoint: POST ${url}/auth/v1/token?grant_type=password
  try {
    console.log('Sending signInWithPassword request via fetch...');
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    console.log(`Auth Status: ${authRes.status} ${authRes.statusText}`);
    const authData = await authRes.json();
    if (!authRes.ok) {
      console.log('Auth failed:', JSON.stringify(authData, null, 2));
      return;
    }

    const token = authData.access_token;
    console.log('Auth success! Access token obtained.');

    // Now query contracts with the token
    console.log('Querying contracts with access token...');
    const dataRes = await fetch(`${url}/rest/v1/contracts?select=id,title,value,signed_date,status&limit=5`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Data Status: ${dataRes.status} ${dataRes.statusText}`);
    const data = await dataRes.json();
    if (dataRes.ok) {
      console.log(`Success! Found ${data.length} contracts.`);
      console.log('Sample data:', JSON.stringify(data, null, 2));
    } else {
      console.log('Data fetch failed:', JSON.stringify(data, null, 2));
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
