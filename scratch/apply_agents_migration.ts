import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read local env
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
    console.log(`\n📦 Applying migration ${filename} to database...`);
    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations', filename);
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Exec SQL
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
        console.error(`⚠️ RPC exec_sql failed, trying fetch fallback...`, error.message);
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
           throw new Error(text);
        } else {
           console.log(`✅ ${filename} applied successfully via POST!`);
        }
    } else {
        console.log(`✅ ${filename} applied successfully via RPC!`);
    }
}

async function main() {
    await applySqlFile('20260603111000_update_agents_system_prompt_kpi_names.sql');
    console.log('\n🎉 Agents System Prompt update applied successfully!');
}

main().catch(console.error);
