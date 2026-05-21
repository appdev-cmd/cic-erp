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

function getUnitSharePct(contract: any, targetUnitId: string): number {
    const isLeadUnit = contract.unit_id === targetUnitId;
    const allocations: any[] = contract.unit_allocations?.allocations || [];

    if (allocations.length === 0) {
        return isLeadUnit ? 100 : 0;
    }

    const match = allocations.find((a: any) => a.unitId === targetUnitId);
    if (!match) return 0;
    return match.percent || 0;
}

async function run() {
    console.log("Analyzing via ContractService.getStats pre-computed logic...");

    const dcsId = "dcs";
    const dateFrom = "2026-01-01";
    const dateTo = "2026-01-31";

    let query = supabase.from('contracts').select('id, value, actual_revenue, admin_profit, rev_profit, cash_received, status, title, contract_code, party_a, signed_date, unit_id, unit_allocations, employee_id, employee_allocations');
    
    query = query.gte('signed_date', dateFrom).lte('signed_date', dateTo);

    const { data, error } = await query;
    if (error || !data) {
        console.error("❌ Failed to fetch contracts:", error?.message);
        return;
    }

    console.log(`Contracts fetched from DB (signed in Jan 2026): ${data.length}`);

    let totalRevenue = 0;
    let totalRevenueProfit = 0;
    let totalValue = 0;
    let totalContracts = 0;

    data.forEach((curr: any) => {
        const sharePct = getUnitSharePct(curr, dcsId);
        if (sharePct === 0) return;

        const fraction = sharePct / 100;
        const val = curr.value || 0;
        const rev = curr.actual_revenue || 0;
        const revProfit = curr.rev_profit || 0;

        totalContracts += 1;
        totalValue += val * fraction;
        totalRevenue += rev * fraction;
        totalRevenueProfit += revProfit * fraction;
    });

    console.log("\n=================== STATS PRE-COMPUTED ===================");
    console.log(`Total Contracts: ${totalContracts}`);
    console.log(`Total Value (Ký kết): ${Math.round(totalValue).toLocaleString()}`);
    console.log(`Total Revenue (Doanh thu thực tế): ${Math.round(totalRevenue).toLocaleString()}`);
    console.log(`Total LNG theo DT (rev_profit): ${Math.round(totalRevenueProfit).toLocaleString()}`);
}

run();
