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

// =================== FINANCIALS FUNCTIONS ===================
function getUnitSharePct(
    contract: { unit_id?: string; unit_allocations?: { allocations?: any[] } },
    targetUnitId: string
): number {
    const allocations: any[] = contract.unit_allocations?.allocations || [];
    const isLeadUnit = contract.unit_id === targetUnitId;
    const supportAlloc = allocations.find(
        (a: any) => a.unitId === targetUnitId && a.role === 'support'
    );

    if (isLeadUnit && allocations.length > 0) {
        const leadAlloc = allocations.find(
            (a: any) => a.unitId === targetUnitId && a.role === 'lead'
        );
        return leadAlloc ? (leadAlloc.percent || 100) : 100;
    } else if (isLeadUnit) {
        return 100;
    } else if (supportAlloc) {
        return supportAlloc.percent || 0;
    }
    return 0;
}

function calculateRevenueFromPayments(
    payments: any[],
    vatRate: number = 10,
    hasVat: boolean = true,
    fallbackRevenue: number = 0
): number {
    if (!payments || payments.length === 0) return fallbackRevenue;

    const revenuePayments = payments.filter(
        (p: any) => p.voucher_type === 'VAT_INVOICE' &&
            ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status)
    );

    let totalPreVat = 0;
    let fallbackGross = 0;

    for (const p of revenuePayments) {
        if (p.vat_invoice_items && p.vat_invoice_items.length > 0) {
            totalPreVat += p.vat_invoice_items.reduce((s: number, item: any) => s + (Number(item.amountBeforeVAT) || 0), 0);
        } else {
            fallbackGross += (Number(p.amount) || 0);
        }
    }

    if (fallbackGross > 0) {
        const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;
        totalPreVat += Math.round(fallbackGross / vatDivisor);
    }

    return totalPreVat;
}

function mapContract(c: any): any {
    const payments: any[] = c.payments || [];
    const lineItems = c.details?.lineItems || c.line_items || [];
    const executionCosts = c.details?.executionCosts || c.execution_costs || [];

    const computedInputCost = lineItems.reduce((sum: number, li: any) => {
        const directVal = (li.directCosts as number) || 0;
        const effectiveDirectCosts = directVal > 0
            ? directVal
            : ((li.directCostDetails as any[]) || []).reduce((s: number, d: any) => s + (d.amount || 0), 0);
        return sum + ((li.inputPrice as number) || 0) * ((li.quantity as number) || 1) + effectiveDirectCosts;
    }, 0);
    const computedExecCost = executionCosts.reduce((sum: number, ec: any) => sum + (ec.amount || 0), 0);
    const estimatedCost = computedInputCost + computedExecCost;

    const actualRevenue = calculateRevenueFromPayments(
        payments, c.vat_rate ?? 10, c.has_vat !== false, c.actual_revenue || 0
    );

    const expectedRevenue = lineItems.reduce((sum: number, li: any) => sum + (li.outputPrice || 0) * (li.quantity || 1), 0);
    const adminProfit = expectedRevenue - estimatedCost;

    const revenueRatio = expectedRevenue > 0 ? (actualRevenue / expectedRevenue) : 0;
    const revProfit = actualRevenue - (estimatedCost * revenueRatio);

    return {
        adminProfit,
        revProfit,
        actualRevenue,
        expectedRevenue,
        estimatedCost
    };
}

async function run() {
    console.log("Comparing DB 'rev_profit' vs Client computed 'revProfit'...");

    const dcsId = "dcs";
    const dateFrom = "2026-01-01";
    const dateTo = "2026-01-31";

    let query = supabase.from('contracts').select('*, payments(amount, paid_amount, status, payment_type, voucher_type, vat_invoice_items)');
    query = query.gte('signed_date', dateFrom).lte('signed_date', dateTo);

    const { data, error } = await query;
    if (error || !data) {
        console.error("❌ Failed to fetch contracts:", error?.message);
        return;
    }

    let totalDbRevProfit = 0;
    let totalClientRevProfit = 0;
    let count = 0;

    console.log(`\nSTT | Mã HĐ | Phân bổ DCS | DB rev_profit | Client revProfit | Chênh lệch`);
    console.log(`-------------------------------------------------------------------------`);

    data.forEach((curr: any) => {
        const sharePct = getUnitSharePct(curr, dcsId);
        if (sharePct === 0) return;

        const fraction = sharePct / 100;
        const dbProfit = (curr.rev_profit || 0) * fraction;

        // Tính bằng mapContract ở client
        const mapped = mapContract(curr);
        const clientProfit = (mapped.revProfit || 0) * fraction;

        const diff = dbProfit - clientProfit;

        totalDbRevProfit += dbProfit;
        totalClientRevProfit += clientProfit;
        count++;

        if (Math.abs(diff) > 1) {
            console.log(`${count.toString().padStart(2, '0')} | ${curr.contract_code.padEnd(20)} | ${(sharePct + '%').padEnd(11)} | ${Math.round(dbProfit).toLocaleString().padStart(13)} | ${Math.round(clientProfit).toLocaleString().padStart(15)} | ${Math.round(diff).toLocaleString().padStart(10)} ⚠️`);
        } else {
            console.log(`${count.toString().padStart(2, '0')} | ${curr.contract_code.padEnd(20)} | ${(sharePct + '%').padEnd(11)} | ${Math.round(dbProfit).toLocaleString().padStart(13)} | ${Math.round(clientProfit).toLocaleString().padStart(15)} | 0`);
        }
    });

    console.log(`\nTotal DB rev_profit: ${Math.round(totalDbRevProfit).toLocaleString()}`);
    console.log(`Total Client revProfit: ${Math.round(totalClientRevProfit).toLocaleString()}`);
    console.log(`Total Discrepancy: ${Math.round(totalDbRevProfit - totalClientRevProfit).toLocaleString()}`);
}

run();
