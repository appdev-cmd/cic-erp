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
        estimatedCost,
        computedInputCost,
        computedExecCost
    };
}

async function run() {
    const { data: contract, error } = await supabase
        .from('contracts')
        .select('*, payments(amount, paid_amount, status, payment_type, voucher_type, vat_invoice_items)')
        .eq('contract_code', 'HĐ_016/DCS_CIC_2026')
        .single();

    if (error || !contract) {
        console.error("❌ Failed:", error?.message);
        return;
    }

    console.log("=== DB Row details field ===");
    console.log("details:", JSON.stringify(contract.details));

    const mapped = mapContract(contract);
    console.log("\n=== Client Computed for HĐ_016 ===");
    console.log("expectedRevenue:", mapped.expectedRevenue);
    console.log("estimatedCost:", mapped.estimatedCost);
    console.log("computedInputCost:", mapped.computedInputCost);
    console.log("computedExecCost:", mapped.computedExecCost);
    console.log("actualRevenue:", mapped.actualRevenue);
    console.log("adminProfit:", mapped.adminProfit);
    console.log("revProfit:", mapped.revProfit);
}

run();
