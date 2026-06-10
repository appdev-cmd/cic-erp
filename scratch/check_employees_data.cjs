const fs = require('fs');
const path = require('path');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
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
    const empRes = await fetch(`${url}/rest/v1/employees?select=id,name,target`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const emps = await empRes.json();

    console.log('--- EMPLOYEES LEGACY TARGETS ---');
    emps.forEach(e => {
      console.log(`Name: "${e.name}"`);
      console.log(`  ID: ${e.id}`);
      console.log(`  Legacy Target: ${JSON.stringify(e.target)}`);
    });

  } catch (err) {
    console.error(err);
  }
}

run();
