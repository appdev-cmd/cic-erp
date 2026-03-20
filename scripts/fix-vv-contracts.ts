/**
 * Script: Fix VV contract codes
 * Change VV_STT/unitCode_CIC_year → VV_STT/unitCode_year
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env from .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envVars: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key?.trim()) envVars[key.trim()] = val.join('=').trim();
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

async function main() {
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, contract_code, contract_type, signed_date')
    .eq('contract_type', 'VV')
    .order('signed_date', { ascending: false });

  if (error) { console.error('Query error:', error); return; }

  console.log(`Found ${contracts?.length || 0} VV contracts\n`);
  let updated = 0;

  for (const c of contracts || []) {
    const code = c.contract_code || c.id;
    if (!code.includes('_CIC_')) {
      console.log(`SKIP: ${code}`);
      continue;
    }
    const newCode = code.replace('_CIC_', '_');
    console.log(`FIX: ${code} → ${newCode}`);

    const { error: e } = await supabase
      .from('contracts')
      .update({ contract_code: newCode })
      .eq('id', c.id);

    if (e) console.error(`  ERROR: ${e.message}`);
    else updated++;
  }

  console.log(`\nDone. Updated ${updated}/${contracts?.length || 0} VV contracts.`);
}

main().catch(console.error);
