const fs = require('fs');
const path = require('path');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  });
  return env;
}

async function run() {
  const env = parseEnv(path.join(__dirname, '..', '.env.local'));
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  try {
    const res = await fetch(`${url}/rest/v1/contracts?select=id,contract_code,value,actual_revenue,signed_date,status&limit=10`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const contracts = await res.json();
    console.log(JSON.stringify(contracts, null, 2));
  } catch (err) {
    console.error(err);
  }
}

run();
