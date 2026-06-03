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
const envConfig = { ...envMain, ...envLocal };

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

  console.log('Querying contracts matching 067 or 068...');
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, contract_code, title, signed_date, created_at, unit_id')
    .or('id.in.("VV_067/DCS_2026","VV_068/DCS_2026"),contract_code.in.("VV_067/DCS_2026","VV_068/DCS_2026")');

  if (error) {
    console.error('Query error:', error);
  } else {
    console.log('Total DCS 2026 contracts:', contracts.length);
    console.log('Matching contracts:', contracts);
  }
}

run();
