import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual .env loading
const loadEnv = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = val;
    });
};

loadEnv(path.resolve(process.cwd(), '.env'));
loadEnv(path.resolve(process.cwd(), '.env.local'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY in env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('🔄 Applying expected_revenue column and trigger migration...\n');

    const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260522111000_add_expected_revenue_column.sql');
    if (!fs.existsSync(sqlPath)) {
        console.error(`❌ Migration file not found: ${sqlPath}`);
        process.exit(1);
    }
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Sending SQL migration to Supabase exec_sql RPC...');
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
        console.error('❌ Failed to apply migration via RPC:', error.message);
        console.error('Details:', error);
        process.exit(1);
    } else {
        console.log('✅ Database migration applied successfully!');
    }
}

main().catch(console.error);
