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

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or Key.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  // Read migration file
  const sqlPath = path.resolve('supabase/migrations/20260605150000_add_onboarding_document_quiz.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    return;
  }
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Executing migration SQL via execute_sql RPC...');
  const { data, error: rpcError } = await supabase.rpc('execute_sql', { query: sql });

  if (rpcError) {
    console.error('RPC execution failed:', rpcError);
    if (rpcError.details) console.error('Details:', rpcError.details);
    if (rpcError.hint) console.error('Hint:', rpcError.hint);
  } else {
    console.log('Migration executed successfully! Result:', data);
  }
}

run();
