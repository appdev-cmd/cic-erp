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
      let value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = value;
    }
  });
  return env;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Checking onboarding_tasks columns...');
  const { data: tData, error: tError } = await supabase
    .from('onboarding_tasks')
    .select('id, document_url, quiz_questions')
    .limit(1);

  if (tError) {
    console.error('Error on onboarding_tasks:', tError.message);
  } else {
    console.log('Success! Columns exist in onboarding_tasks.');
  }

  console.log('Checking onboarding_checklist_items columns...');
  const { data: iData, error: iError } = await supabase
    .from('onboarding_checklist_items')
    .select('id, document_url, quiz_score, quiz_passed')
    .limit(1);

  if (iError) {
    console.error('Error on onboarding_checklist_items:', iError.message);
  } else {
    console.log('Success! Columns exist in onboarding_checklist_items.');
  }
}

run();
