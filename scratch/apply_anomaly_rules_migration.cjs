const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

function parseEnv(p) {
  if (!fs.existsSync(p)) return {};
  const env = {};
  for (const line of fs.readFileSync(p, 'utf-8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };
// .env.local comments out the service role key — prefer .env's active value.
const serviceKey = parseEnv('.env').VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const url = env.VITE_SUPABASE_URL;

if (!url || !serviceKey) { console.error('Missing URL or service role key'); process.exit(1); }

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function run() {
  const sql = fs.readFileSync('supabase/migrations/20260612090000_contract_anomaly_rules.sql', 'utf-8');
  console.log('Applying migration via exec_sql (service role)...');
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) { console.error('FAILED:', JSON.stringify(error)); process.exit(1); }
  console.log('exec_sql OK:', JSON.stringify(data));

  // Verify
  const { data: rows, error: selErr } = await supabase
    .from('contract_anomaly_rules')
    .select('rule_key, enabled, severity, params')
    .order('rule_key');
  if (selErr) { console.error('VERIFY FAILED:', JSON.stringify(selErr)); process.exit(1); }
  console.log(`VERIFY OK — ${rows.length} rows seeded.`);
  console.log(rows.slice(0, 3));
}
run();
