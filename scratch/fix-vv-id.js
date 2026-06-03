import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Helper to parse .env files
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

// We need to implement the PK Migration logic here in Node because importing contractService.ts 
// directly might fail due to ESM/TS compiling differences.
async function migrateContractId(oldId, newId, newContractCode) {
  console.log(`Migrating contract ${oldId} -> ${newId} (code: ${newContractCode})...`);

  // 1. Fetch old contract row
  const { data: oldContract, error: fetchError } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', oldId)
    .maybeSingle();

  if (fetchError || !oldContract) {
    console.error(`Failed to fetch old contract ${oldId}:`, fetchError || 'Not found');
    return false;
  }

  // 1.5. Temporarily change old contract's contract_code to avoid UNIQUE constraint violation when inserting new row
  const tempCode = `${newContractCode}_TEMP_${Date.now()}`;
  const { error: tempUpdateError } = await supabase
    .from('contracts')
    .update({ contract_code: tempCode })
    .eq('id', oldId);

  if (tempUpdateError) {
    console.error(`Failed to update old contract's contract_code to temp code:`, tempUpdateError.message);
    return false;
  }
  console.log(`Temporarily renamed contract_code of ${oldId} to ${tempCode}`);

  // 2. Build new payload
  const newPayload = {
    ...oldContract,
    id: newId,
    contract_code: newContractCode
  };

  // 3. Insert new contract row
  const { data: insertRes, error: insertError } = await supabase
    .from('contracts')
    .insert(newPayload)
    .select()
    .single();

  if (insertError) {
    console.error(`Failed to insert new contract with ID ${newId}:`, insertError.message);
    // Rollback temp code rename
    await supabase.from('contracts').update({ contract_code: oldContract.contract_code }).eq('id', oldId);
    return false;
  }
  console.log(`Inserted new contract row for ${newId}.`);

  // 4. Update foreign keys in related tables
  const tables = [
    'payments',
    'contract_business_plans',
    'contract_task_definitions',
    'contract_documents',
    'contract_relations'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .update({ contract_id: newId })
        .eq('contract_id', oldId)
        .select();

      console.log(`Updated ${table} table contract_id references. Affected rows:`, data?.length || 0);
    } catch (err) {
      console.warn(`Failed to update ${table} references:`, err);
    }
  }

  // Handle special columns in contract_relations
  try {
    const { data: rel1 } = await supabase
      .from('contract_relations')
      .update({ related_contract_id: newId })
      .eq('related_contract_id', oldId)
      .select();
    console.log(`Updated contract_relations(related_contract_id). Affected rows:`, rel1?.length || 0);

    const { data: rel2 } = await supabase
      .from('contract_relations')
      .update({ requested_by: newId })
      .eq('requested_by', oldId)
      .select();
    console.log(`Updated contract_relations(requested_by). Affected rows:`, rel2?.length || 0);
  } catch (err) {
    console.warn(`Failed to update contract_relations special columns:`, err);
  }

  // 5. Delete old contract row
  const { error: deleteError } = await supabase
    .from('contracts')
    .delete()
    .eq('id', oldId);

  if (deleteError) {
    console.error(`Failed to delete old contract ${oldId}:`, deleteError.message);
    return false;
  }
  console.log(`Successfully deleted old contract ${oldId}.`);
  return true;
}

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

  console.log('Starting migration...');
  const success1 = await migrateContractId('VV_067/DCS_2026', 'VV_036/DCS_2026', 'VV_036/DCS_2026');
  const success2 = await migrateContractId('VV_068/DCS_2026', 'VV_037/DCS_2026', 'VV_037/DCS_2026');

  if (success1 && success2) {
    console.log('All migrations completed successfully!');
  } else {
    console.log('Some migrations failed.');
  }
}

run();
