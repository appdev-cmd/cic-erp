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

// Hàm helper để tính tỷ lệ phân bổ của đơn vị cho hợp đồng
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
    console.log("Analyzing DCS January 2026 statistics and contract list discrepancies...");

    // 1. Lấy tất cả hợp đồng và payments
    const { data: contracts, error } = await supabase
        .from('contracts')
        .select('id, contract_code, title, value, estimated_cost, status, unit_id, unit_allocations, end_date, signed_date, vat_rate, has_vat, payments(amount, paid_amount, status, payment_type, voucher_type, payment_date, invoice_date, vat_invoice_items)');

    if (error || !contracts) {
        console.error("❌ Failed to fetch contracts:", error?.message);
        return;
    }

    const dcsUnitId = "dcs"; // DCS unit ID
    // Hãy tìm chính xác unitId của DCS trong hệ thống
    const { data: units } = await supabase.from('units').select('id, name');
    console.log("Units in system:", units);
    const dcsUnit = units?.find(u => u.name.toUpperCase().includes('DCS'));
    const dcsId = dcsUnit ? dcsUnit.id : 'dcs';
    console.log(`Using DCS Unit ID: ${dcsId} (${dcsUnit?.name})`);

    // Khoảng thời gian: tháng 1 năm 2026
    const startPeriodDate = new Date('2026-01-01T00:00:00');
    const endPeriodDate = new Date('2026-01-31T23:59:59');

    const isInPeriod = (dateStr: string | null | undefined): boolean => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= startPeriodDate && d <= endPeriodDate;
    };

    let totalRevenueStats = 0;
    let totalRevenueProfitStats = 0;
    const contractStatsList: any[] = [];

    // Chạy thống kê giống getStatsFallback
    contracts.forEach((curr: any) => {
        const sharePct = getUnitSharePct(curr, dcsId);
        if (sharePct === 0) return;

        const fraction = sharePct / 100;
        const isSignedMatch = isInPeriod(curr.signed_date);
        const val = curr.value || 0;
        const estimatedCost = curr.estimated_cost || 0;
        const hasVat = curr.has_vat !== false;
        const vatRate = curr.vat_rate ?? 10;
        const expectedRevenue = hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val;
        const expectedProfit = expectedRevenue - estimatedCost;

        const payments = curr.payments || [];

        // Tính doanh thu trong tháng 1/2026
        const revenuePayments = payments.filter(
            (p: any) => p.voucher_type === 'VAT_INVOICE' &&
                ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status) &&
                isInPeriod(p.invoice_date || p.payment_date)
        );

        let contractRevInPeriod = 0;
        revenuePayments.forEach((p: any) => {
            if (p.vat_invoice_items && p.vat_invoice_items.length > 0) {
                contractRevInPeriod += p.vat_invoice_items.reduce((s: number, item: any) => s + (Number(item.amountBeforeVAT) || 0), 0);
            } else {
                const gross = Number(p.amount) || 0;
                const divisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;
                contractRevInPeriod += Math.round(gross / divisor);
            }
        });

        // LNG trong kỳ phát sinh
        let contractRevProfitInPeriod = 0;
        if (expectedRevenue > 0) {
            const profitRatio = expectedProfit / expectedRevenue;
            contractRevProfitInPeriod = contractRevInPeriod * profitRatio;
        }

        totalRevenueStats += contractRevInPeriod * fraction;
        totalRevenueProfitStats += contractRevProfitInPeriod * fraction;

        // Lưu thông tin để phân tích
        if (isSignedMatch || contractRevInPeriod > 0) {
            contractStatsList.push({
                id: curr.id,
                code: curr.contract_code,
                title: curr.title,
                signed_date: curr.signed_date,
                isSignedMatch,
                revenueInPeriod: contractRevInPeriod * fraction,
                revenueProfitInPeriod: contractRevProfitInPeriod * fraction,
                revProfitLifetime: (curr.rev_profit || 0) * fraction, // Giá trị lưu trọn đời
                expectedRevenue,
                expectedProfit,
                value: val * fraction
            });
        }
    });

    console.log("\n=================== STATS PANEL CALCULATED ===================");
    console.log(`Total Revenue in Period: ${Math.round(totalRevenueStats).toLocaleString()} (UI: 8,947,241,230)`);
    console.log(`Total LNG theo DT in Period: ${Math.round(totalRevenueProfitStats).toLocaleString()} (UI: 2,313,756,033)`);

    console.log("\n=================== ANALYZING CONTRACT LIST (SIGNED IN JAN 2026) ===================");
    // Danh sách hợp đồng được hiển thị khi lọc signed_date trong tháng 1/2026
    const signedInJan = contractStatsList.filter(c => c.isSignedMatch);
    console.log(`Total contracts signed in Jan 2026: ${signedInJan.length}`);
    
    let sumRevProfitLifetime = 0;
    signedInJan.forEach((c, idx) => {
        sumRevProfitLifetime += c.revProfitLifetime;
        // console.log(`${idx+1}. [${c.code}] ${c.title} (Signed: ${c.signed_date}) | LNG Lifetime: ${Math.round(c.revProfitLifetime).toLocaleString()} | LNG in Period: ${Math.round(c.revenueProfitInPeriod).toLocaleString()}`);
    });
    console.log(`Sum of LNG Lifetime on those signed in Jan 2026: ${Math.round(sumRevProfitLifetime).toLocaleString()} (User excel sum: 2,255,335,388)`);

    const discrepancy = totalRevenueProfitStats - sumRevProfitLifetime;
    console.log(`Discrepancy: ${Math.round(discrepancy).toLocaleString()} (UI Stats vs Excel Sum)`);

    console.log("\n=================== CONTRACTS SIGNED OUTSIDE JAN 2026 BUT HAD REVENUE IN JAN 2026 ===================");
    const signedOutsideJanWithRevenue = contractStatsList.filter(c => !c.isSignedMatch && c.revenueInPeriod > 0);
    let sumOutsideRevProfitInPeriod = 0;
    signedOutsideJanWithRevenue.forEach((c, idx) => {
        sumOutsideRevProfitInPeriod += c.revenueProfitInPeriod;
        console.log(`${idx+1}. [${c.code}] ${c.title} (Signed: ${c.signed_date}) | Revenue in Period: ${Math.round(c.revenueInPeriod).toLocaleString()} | LNG in Period: ${Math.round(c.revenueProfitInPeriod).toLocaleString()}`);
    });
    console.log(`Sum of LNG in Period for contracts signed outside Jan 2026: ${Math.round(sumOutsideRevProfitInPeriod).toLocaleString()}`);

    console.log("\n=================== REVENUE & PROFIT IN PERIOD FOR JAN 2026 CONTRACTS ===================");
    let sumPeriodRevProfitOfJanContracts = 0;
    signedInJan.forEach(c => {
        sumPeriodRevProfitOfJanContracts += c.revenueProfitInPeriod;
    });
    console.log(`Sum of LNG in Period for contracts signed in Jan 2026: ${Math.round(sumPeriodRevProfitOfJanContracts).toLocaleString()}`);
    console.log(`Total LNG in Period calculated from both = ${Math.round(sumPeriodRevProfitOfJanContracts + sumOutsideRevProfitInPeriod).toLocaleString()}`);
}

run();
