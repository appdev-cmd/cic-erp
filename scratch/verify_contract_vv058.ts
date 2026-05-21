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

async function verify() {
    console.log("🔍 Verifying contract VV_058/DCS_2026 in DB...");
    const { data: contracts, error } = await supabase
        .from('contracts')
        .select('id, contract_code, value, actual_revenue, admin_profit, rev_profit, status')
        .ilike('contract_code', '%VV_058/DCS_2026%');

    if (error) {
        console.error("❌ Failed to query DB:", error.message);
        return;
    }

    if (!contracts || contracts.length === 0) {
        console.log("❌ Contract VV_058/DCS_2026 not found.");
        return;
    }

    const c = contracts[0];
    console.log("\n================ CONTRACT DETAILS ================");
    console.log(`ID: ${c.id}`);
    console.log(`Code: ${c.contract_code}`);
    console.log(`Status: ${c.status}`);
    console.log(`Ký kết (value): ${Number(c.value).toLocaleString()}`);
    console.log(`Doanh thu (actual_revenue): ${Number(c.actual_revenue).toLocaleString()}`);
    console.log(`LNG Quản trị (admin_profit): ${Number(c.admin_profit).toLocaleString()}`);
    console.log(`LNG theo DT (rev_profit): ${Number(c.rev_profit).toLocaleString()}`);
    console.log("==================================================\n");

    const expectedRevProfit = Math.round((c.actual_revenue / c.value) * c.admin_profit);
    console.log(`Expected rev_profit: ${expectedRevProfit.toLocaleString()}`);
    
    if (Math.round(c.rev_profit) === expectedRevProfit) {
        console.log("✅ SUCCESS: rev_profit matches expected proportional calculation!");
    } else {
        console.log("❌ FAILURE: rev_profit does not match expected proportional calculation!");
    }
}

verify();
