import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[key] = value;
    }
  });
  return env;
}

const envConfig = {
  ...parseEnv('.env'),
  ...parseEnv('.env.local')
};

const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_SERVICE_ROLE_KEY || envConfig.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, contract_code, title, signed_date, unit_id')
    .eq('unit_id', 'dcs')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching contracts:', error);
  } else {
    console.log('Latest 10 contracts for dcs:', contracts);
  }
}

run();
