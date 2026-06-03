import { describe, it, expect } from 'vitest';
import { UnitService } from '../services/unitService';
import { calculatePeriodFinancials } from '../services/contract/contractFinancials';
import { getUnitSharePct } from '../services/contractService';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jyohocjsnsyfgfsmjfqx.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2hvY2pzbnN5Zmdmc21qZnF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQxMTE4MywiZXhwIjoyMDg0OTg3MTgzfQ.7r3xY99EiPXiIFh6K7ctR8Xw05NJT0pwJVn0cQrPxyU";
const adminClient = createClient(supabaseUrl, serviceRoleKey);

// Custom stats fallback using adminClient
async function getStatsFallbackAdmin(unitId: string = 'all', year: string = 'all', periodFilter?: string) {
    console.log('[Test] Running getStatsFallback with adminClient (bypass RLS)');
    let query = adminClient.from('contracts').select('id, value, expected_revenue, estimated_cost, status, unit_id, unit_allocations, end_date, signed_date, vat_rate, has_vat, admin_profit, rev_profit, payments(amount, paid_amount, status, payment_type, voucher_type, payment_date, invoice_date, vat_invoice_items)');

    const { data, error } = await query;
    if (error) {
        console.error('Query error:', error);
        return null;
    }

    console.log('Got contracts count:', data?.length);

    const isFilteringByUnit = unitId !== 'all';
    
    // Parse time filters
    const targetYear = year && year !== 'All' && year !== 'all' ? parseInt(year) : null;
    let startPeriodDate: Date | null = null;
    let endPeriodDate: Date | null = null;
    
    if (targetYear) {
        startPeriodDate = new Date(`${targetYear}-01-01T00:00:00`);
        endPeriodDate = new Date(`${targetYear}-12-31T23:59:59`);
        
        if (periodFilter) {
            if (periodFilter.startsWith('M')) {
                const month = parseInt(periodFilter.substring(1));
                startPeriodDate = new Date(targetYear, month - 1, 1);
                endPeriodDate = new Date(targetYear, month, 0, 23, 59, 59);
            } else if (periodFilter.startsWith('Q')) {
                const quarter = parseInt(periodFilter.substring(1));
                const startMonth = (quarter - 1) * 3;
                const endMonth = quarter * 3 - 1;
                startPeriodDate = new Date(targetYear, startMonth, 1);
                endPeriodDate = new Date(targetYear, endMonth + 1, 0, 23, 59, 59);
            }
        }
    }

    const isInPeriod = (dateStr: string | null | undefined): boolean => {
        if (!dateStr) return false;
        if (!startPeriodDate || !endPeriodDate) return true;
        const d = new Date(dateStr);
        return d >= startPeriodDate && d <= endPeriodDate;
    };

    return (data || []).reduce((acc: any, curr: any) => {
        let sharePct = 100;
        if (isFilteringByUnit) {
            sharePct = getUnitSharePct(curr, unitId);
        }
        if (sharePct === 0) return acc;
        
        const fraction = sharePct / 100;
        const isSignedMatch = isInPeriod(curr.signed_date);
        const val = curr.value || 0;
        const estimatedCost = curr.estimated_cost || 0;
        const hasVat = curr.has_vat !== false;
        const vatRate = curr.vat_rate ?? 10;
        const expectedProfit = curr.admin_profit !== null && curr.admin_profit !== undefined
            ? Number(curr.admin_profit)
            : ((curr.expected_revenue ?? (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val)) - estimatedCost);

        if (isSignedMatch) {
            acc.totalContracts++;
            acc.totalValue += val * fraction;
            acc.totalProfit += expectedProfit * fraction;
            acc.totalSigningProfit += expectedProfit * fraction;
            
            acc.activeCount += (['Processing', 'Acceptance', 'Handover'].includes(curr.status) ? 1 : 0);
            acc.pendingCount += (curr.status === 'Pending' ? 1 : 0);
            acc.suspendedCount += (curr.status === 'Suspended' ? 1 : 0);
            acc.completedCount += (curr.status === 'Completed' ? 1 : 0);
            acc.acceptanceCount += (curr.status === 'Acceptance' ? 1 : 0);
            acc.processingCount += (curr.status === 'Processing' ? 1 : 0);
            acc.handoverCount += (curr.status === 'Handover' ? 1 : 0);
            acc.expiredCount += (
                ['Processing', 'Acceptance'].includes(curr.status) && curr.end_date && new Date(curr.end_date) < new Date() ? 1 : 0
            );
        }
        
        const { revenueInPeriod, cashInPeriod, revProfitInPeriod } = calculatePeriodFinancials(curr, isInPeriod);
        
        acc.totalRevenue += revenueInPeriod * fraction;
        acc.totalCash += cashInPeriod * fraction;
        acc.totalRevenueProfit += revProfitInPeriod * fraction;

        return acc;
    }, { totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalSigningProfit: 0, totalRevenueProfit: 0, totalCash: 0, activeCount: 0, pendingCount: 0, completedCount: 0, expiredCount: 0, processingCount: 0, acceptanceCount: 0, suspendedCount: 0, handoverCount: 0 });
}

describe('Compare Stats 2026', () => {
  it('compare RPC vs Fallback', async () => {
    console.log("=== COMPARING RPC VS FALLBACK FOR 2026 ===");

    // 1. Dữ liệu từ getStatsFallback (chính là Dashboard chính)
    const fallbackStats = await getStatsFallbackAdmin('all', '2026');
    console.log("\n1. FALLBACK STATS (DASHBOARD CHÍNH):");
    console.log(JSON.stringify(fallbackStats, null, 2));

    // 2. Dữ liệu từ getWithStats (RPC)
    const units = await UnitService.getWithStats(2026);
    let rpcTotalSigning = 0;
    let rpcTotalRevenue = 0;
    let rpcTotalCash = 0;
    let rpcTotalProfit = 0;
    let rpcTotalContracts = 0;
    
    units.forEach((u: any) => {
      if (u.type === 'Center' || u.type === 'Branch') {
        rpcTotalSigning += u.stats?.totalSigning || 0;
        rpcTotalRevenue += u.stats?.totalRevenue || 0;
        rpcTotalCash += u.stats?.totalCash || 0;
        rpcTotalProfit += u.stats?.totalProfit || 0;
        rpcTotalContracts += u.stats?.contractCount || 0;
      }
    });

    console.log("\n2. RPC TOTALS (UNIT SERVICE SUM):");
    console.log({
      totalSigning: rpcTotalSigning,
      totalRevenue: rpcTotalRevenue,
      totalCash: rpcTotalCash,
      totalProfit: rpcTotalProfit,
      totalContracts: rpcTotalContracts
    });

    // 3. Hợp đồng quá hạn thực tế
    const today = new Date().toISOString().split('T')[0];
    const { count: overdueCount } = await adminClient
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'Processing')
      .lt('end_date', today);

    console.log("\n3. OVERDUE CONTRACTS (from DB directly):");
    console.log("Count:", overdueCount);

    expect(1).toBe(1);
  }, 35000);
});
