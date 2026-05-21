import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual env loading
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

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: contract, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('contract_code', 'HĐ_016/DCS_CIC_2026')
        .single();

    if (error || !contract) {
        console.error("❌ Failed to fetch contract:", error?.message);
        return;
    }

    console.log("=== DB Contract HĐ_016 ===");
    console.log(`Value: ${contract.value}`);
    console.log(`Vat rate: ${contract.vat_rate}`);
    console.log(`Has Vat: ${contract.has_vat}`);
    console.log(`Estimated cost: ${contract.estimated_cost}`);
    console.log(`Actual revenue: ${contract.actual_revenue}`);
    console.log(`Admin profit: ${contract.admin_profit}`);
    console.log(`Rev profit: ${contract.rev_profit}`);
    console.log(`Line items:`, JSON.stringify(contract.line_items || contract.details?.lineItems));
}

run();
