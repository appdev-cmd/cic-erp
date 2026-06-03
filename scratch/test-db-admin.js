import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let value = parts.slice(1).join('=').trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[key] = value;
    }
  });
  return env;
}

const envMain = parseEnv('.env');
const envLocal = parseEnv('.env.local');

console.log('Main Env Keys:', Object.keys(envMain));
console.log('Local Env Keys:', Object.keys(envLocal));

const supabaseUrl = envLocal.VITE_SUPABASE_URL || envMain.VITE_SUPABASE_URL;
const serviceRoleKey = envLocal.VITE_SUPABASE_SERVICE_ROLE_KEY || envMain.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', supabaseUrl);
console.log('Service Key Length:', serviceRoleKey ? serviceRoleKey.length : 0);

if (!serviceRoleKey) {
  console.error('No service role key found!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  // 1. Fetch DCS Unit
  const { data: units } = await supabase.from('units').select('*');
  const dcs = units?.find(u => u.code === 'DCS');
  console.log('DCS Unit details:', dcs);

  // 2. Fetch sequences
  const { data: sequences } = await supabase.from('contract_sequences').select('*');
  console.log('All Sequences:', sequences);

  // 3. Search for contract code like VV_%DCS%2026
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, contract_code, title, signed_date, value, created_at')
    .eq('unit_id', 'dcs')
    .like('contract_code', 'VV_%')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Contract query error:', error);
  } else {
    console.log(`Found ${contracts.length} contracts for DCS with code starting with VV_:`);
    contracts.forEach(c => {
      console.log(`- ${c.contract_code} (ID: ${c.id}) | Title: ${c.title} | Signed: ${c.signed_date} | Created: ${c.created_at}`);
    });
  }
}

run();
