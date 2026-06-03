import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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
  console.log('Logging in as dev user...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: envConfig.VITE_DEV_EMAIL,
    password: envConfig.VITE_DEV_PASSWORD
  });

  if (authError) {
    console.error('Sign in failed:', authError);
    return;
  }

  console.log('Sign in successful:', authData.user.email);

  // Read migration file
  const sqlPath = path.resolve('supabase/migrations/20260603150000_sync_contract_sequences.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    return;
  }
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Executing migration SQL via exec_sql RPC...');
  const { data, error: rpcError } = await supabase.rpc('exec_sql', { query: sql });

  if (rpcError) {
    console.error('RPC execution failed:', rpcError);
  } else {
    console.log('Migration executed successfully! Result:', data);
  }
}

run();
