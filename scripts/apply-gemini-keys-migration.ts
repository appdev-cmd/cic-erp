import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env.local loading
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
  // Try .env if .env.local not found
  envContent = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
}

envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    process.env[key] = val;
});

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// We prefer using service role key if available to run DDL queries, otherwise fallback to anon key
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars: VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('📦 Applying Gemini Keys migration...\n');

    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260613060000_create_gemini_keys.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log(`  Reading SQL migration: ${sqlPath}`);
    
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });
    
    if (error) {
        console.warn('⚠️  RPC execute_sql failed, trying direct REST post...', error.message);
        
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ query: sql })
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`❌ Failed to apply migration: ${res.status} - ${text}`);
            process.exit(1);
        } else {
            console.log('✅ Migration applied successfully via REST!');
        }
    } else {
        console.log('✅ Migration applied successfully via RPC!');
    }
}

main().catch(console.error);
