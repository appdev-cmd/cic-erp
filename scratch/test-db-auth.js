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

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const anonKey = envConfig.VITE_SUPABASE_ANON_KEY;
const email = envConfig.VITE_DEV_EMAIL;
const password = envConfig.VITE_DEV_PASSWORD;

console.log('URL:', supabaseUrl);
console.log('Email:', email);

const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  // Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('Sign in failed:', authError);
    return;
  }

  console.log('Sign in successful for user:', authData.user.email);

  // 1. Fetch DCS Unit
  const { data: units } = await supabase.from('units').select('*');
  const dcs = units?.find(u => u.code === 'DCS');
  console.log('DCS Unit details:', dcs);

  if (!dcs) {
    console.log('Available units:', units);
    return;
  }

  // 2. Fetch sequences
  const { data: sequences, error: seqError } = await supabase.from('contract_sequences').select('*');
  if (seqError) {
    console.error('Sequences query error:', seqError);
  } else {
    console.log('DCS sequences in DB:', sequences.filter(s => s.unit_id === dcs.id));
  }

  // 3. Search for contract code like VV_%DCS%2026
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, contract_code, title, signed_date, value, created_at')
    .eq('unit_id', dcs.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Contract query error:', error);
  } else {
    console.log(`Found ${contracts.length} contracts for DCS:`);
    contracts.slice(0, 15).forEach(c => {
      console.log(`- ${c.contract_code} (ID: ${c.id}) | Title: ${c.title} | Signed: ${c.signed_date} | Created: ${c.created_at}`);
    });
  }
}

run();
