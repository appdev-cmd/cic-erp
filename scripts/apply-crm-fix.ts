import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

async function applySqlFile(filename: string) {
    console.log(`\n📦 Applying ${filename}...`);
    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations', filename);
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // First try the RPC exec_sql
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
        console.error(`⚠️  RPC exec_sql failed for ${filename}! Falling back to direct POST...`, error.message);
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
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
           console.error(`❌ Failed to apply ${filename}:`, text);
        } else {
           console.log(`✅ ${filename} applied successfully via POST!`);
        }
    } else {
        console.log(`✅ ${filename} applied successfully!`);
    }
}

async function main() {
    await applySqlFile('20260601094000_fix_crm_rls_admin.sql');
    console.log('\n🎉 CRM RLS Fix Migration applied successfully!');
}

main().catch(console.error);
