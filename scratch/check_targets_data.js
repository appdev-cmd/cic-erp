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

async function run() {
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const env = parseEnv(envLocalPath);
  if (!env) {
    console.error('No .env.local found');
    return;
  }

  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing URL or Key');
    return;
  }

  console.log('Fetching targets for 2026...');
  try {
    const res = await fetch(`${url}/rest/v1/employee_targets?year=eq.2026&select=*`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (res.ok) {
      const targets = await res.json();
      console.log(`Found ${targets.length} targets for 2026:`);
      
      // Fetch employees to map names
      const empRes = await fetch(`${url}/rest/v1/employees?select=id,name`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      const emps = await empRes.json();
      const empMap = {};
      emps.forEach(e => empMap[e.id] = e.name);

      targets.forEach(t => {
        const empName = empMap[t.employee_id] || 'Unknown';
        console.log(`- ${empName} (${t.employee_id}): signing=${t.signing}, revenue=${t.revenue}, unit_id=${t.unit_id}`);
      });
    } else {
      console.log('Error fetching targets:', await res.text());
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
