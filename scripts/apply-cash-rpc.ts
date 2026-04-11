import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env loading
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
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
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('📦 Applying cash RPC migration...\n');

    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260411030047_fix_cash_rpc.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Due to permissions, we'll try to execute it statement by statement
    // but the SQL is just one DROP and one CREATE OR REPLACE.
    
    const statements = [
        `DROP FUNCTION IF EXISTS get_units_with_stats(INTEGER);`,
        sql.split('DROP FUNCTION IF EXISTS get_units_with_stats(INTEGER);')[1].trim()
    ];

    for (let i = 0; i < statements.length; i++) {
        if (!statements[i]) continue;
        console.log(`  Executing statement ${i + 1}/${statements.length}...`);
        
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ query: statements[i] })
        });

        if (!res.ok) {
            const text = await res.text();
            console.log(`  ⚠️  Statement ${i + 1} response: ${res.status} - ${text}`);
        } else {
            console.log(`  ✅ Statement ${i + 1} executed`);
        }
    }
}

main().catch(console.error);
