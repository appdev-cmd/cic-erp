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

  console.log('Fetching all targets...');
  try {
    const res = await fetch(`${url}/rest/v1/employee_targets?select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });

    if (res.ok) {
      const targets = await res.json();
      console.log(`Found ${targets.length} targets:`);
      
      const empRes = await fetch(`${url}/rest/v1/employees?select=id,name`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });
      const emps = await empRes.json();
      const empMap = {};
      emps.forEach(e => empMap[e.id] = e.name);

      targets.forEach(t => {
        const empName = empMap[t.employee_id] || 'Unknown';
        console.log(`- ${empName} (${t.employee_id}): year=${t.year}, signing=${t.signing}, revenue=${t.revenue}, unit_id=${t.unit_id}`);
      });
    } else {
      console.log('Error:', await res.text());
    }
  } catch (err) {
    console.error(err);
  }
}

run();
