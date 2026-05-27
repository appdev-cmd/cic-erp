import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env files
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const DEFAULT_SUPABASE_URL = 'https://jyohocjsnsyfgfsmjfqx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2hvY2pzbnN5Zmdmc21qZnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1MzQ3MzgsImV4cCI6MjA1MzExMDczOH0.geU7wqhNwO3eBmf_QLnLxoS5bGBxJRqotXw6qz5l6dA';

const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const isDevBypass = process.env.VITE_DEV_BYPASS_AUTH === 'true';
const supabaseKey = (isDevBypass && process.env.VITE_SUPABASE_SERVICE_ROLE_KEY)
    ? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
    : (process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY);

console.log('--- SUPABASE CONNECTION DIAGNOSTIC ---');
console.log('Supabase URL:', supabaseUrl);
console.log('Using Service Role Key?', !!(isDevBypass && process.env.VITE_SUPABASE_SERVICE_ROLE_KEY));
console.log('Key prefix:', supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'null');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Thử truy vấn bảng contracts hoặc employees
    console.log('\nTesting query from "contracts" table...');
    const { data: contracts, error: errContracts } = await supabase
      .from('contracts')
      .select('id')
      .limit(1);
    
    if (errContracts) {
      console.error('❌ Query "contracts" failed:', errContracts);
    } else {
      console.log('✅ Query "contracts" success! Data length:', contracts?.length);
    }

    console.log('\nTesting query from "employees" table...');
    const { data: employees, error: errEmployees } = await supabase
      .from('employees')
      .select('id')
      .limit(1);

    if (errEmployees) {
      console.error('❌ Query "employees" failed:', errEmployees);
    } else {
      console.log('✅ Query "employees" success! Data length:', employees?.length);
    }
  } catch (err: any) {
    console.error('❌ Unexpected exception:', err);
  }
}

testConnection();
