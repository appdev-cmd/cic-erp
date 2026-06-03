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

  // 1. Call preview_next_contract_number for DCS and 2026
  const { data: preview, error: previewError } = await supabase.rpc('preview_next_contract_number', {
    p_unit_id: 'dcs',
    p_year: 2026
  });

  if (previewError) {
    console.error('Preview RPC error:', previewError);
  } else {
    console.log('Preview next number for DCS 2026:', preview);
  }

  // 2. Query contract_sequences
  const { data: sequences } = await supabase.from('contract_sequences').select('*');
  console.log('All Sequences:', sequences);

  // 3. Query contracts for DCS signed in 2026 to see the actual max numbers
  const { data: contracts, error: contractError } = await supabase
    .from('contracts')
    .select('contract_code, signed_date')
    .eq('unit_id', 'dcs')
    .gte('signed_date', '2026-01-01')
    .lte('signed_date', '2026-12-31');

  if (contractError) {
    console.error('Contract query error:', contractError);
  } else {
    console.log('Found', contracts.length, 'contracts for DCS in 2026.');
    const vvNumbers = contracts
      .filter(c => c.contract_code.startsWith('VV_'))
      .map(c => {
        const m = c.contract_code.match(/VV_(\d+)/);
        return m ? parseInt(m[1]) : 0;
      })
      .sort((a, b) => b - a);

    const hdNumbers = contracts
      .filter(c => c.contract_code.startsWith('HĐ_'))
      .map(c => {
        const m = c.contract_code.match(/HĐ_(\d+)/);
        return m ? parseInt(m[1]) : 0;
      })
      .sort((a, b) => b - a);

    console.log('Max DCS VV number in contracts table:', vvNumbers[0], 'All VV numbers:', vvNumbers.slice(0, 10));
    console.log('Max DCS HĐ number in contracts table:', hdNumbers[0], 'All HĐ numbers:', hdNumbers.slice(0, 10));
  }
}

run();
