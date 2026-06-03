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

const envConfig = {
  ...envMain,
  ...envLocal
};

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: envConfig.VITE_DEV_EMAIL,
    password: envConfig.VITE_DEV_PASSWORD
  });

  if (authError) {
    console.error('Sign in failed:', authError);
    return;
  }

  // Fetch all contracts
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('contract_code, signed_date, unit_id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total contracts fetched:', contracts.length);

  const groups = {};

  contracts.forEach(c => {
    if (!c.contract_code || !c.unit_id) return;
    const match = c.contract_code.match(/^[A-ZĐa-z]+_(\d+)\//);
    if (!match) return;
    const stt = parseInt(match[1]);
    const year = c.signed_date ? new Date(c.signed_date).getFullYear() : 2026;
    const key = `${c.unit_id}_${year}`;
    if (!groups[key]) {
      groups[key] = { unit_id: c.unit_id, year, max_value: 0, count: 0 };
    }
    groups[key].count++;
    if (stt > groups[key].max_value) {
      groups[key].max_value = stt;
    }
  });

  console.log('Computed sequences:');
  Object.values(groups).forEach(g => {
    console.log(`- Unit: ${g.unit_id} | Year: ${g.year} | Max STT: ${g.max_value} | Total Contracts: ${g.count}`);
  });
}

run();
