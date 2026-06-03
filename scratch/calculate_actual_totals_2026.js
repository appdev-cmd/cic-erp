import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Tự parse file .env.local
const env = {};
const parseEnvFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
};
parseEnvFile('.env.local');

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to calculate unit share percent
const getUnitSharePct = (contract, targetUnitId) => {
  const allocations = contract.unit_allocations?.allocations || [];
  const isLeadUnit = contract.unit_id === targetUnitId;
  const supportAlloc = allocations.find(
    (a) => a.unitId === targetUnitId && a.role === 'support'
  );

  if (isLeadUnit && allocations.length > 0) {
    const leadAlloc = allocations.find(
      (a) => a.unitId === targetUnitId && a.role === 'lead'
    );
    return leadAlloc ? (leadAlloc.percent || 100) : 100;
  } else if (isLeadUnit) {
    return 100;
  } else if (supportAlloc) {
    return supportAlloc.percent || 0;
  }
  return 0;
};

// Helper for period check
const targetYear = 2026;
const startPeriodDate = new Date(`${targetYear}-01-01T00:00:00`);
const endPeriodDate = new Date(`${targetYear}-12-31T23:59:59`);
const isInPeriod = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= startPeriodDate && d <= endPeriodDate;
};

// calculatePeriodFinancials
const calculatePeriodFinancials = (contract, isInPeriodFn) => {
  const payments = contract.payments || [];
  const val = contract.value || 0;
  const estimatedCost = contract.estimated_cost || 0;
  const hasVat = contract.has_vat !== false;
  const vatRate = contract.vat_rate ?? 10;

  const expectedRevenue = contract.expected_revenue !== null && contract.expected_revenue !== undefined
    ? Number(contract.expected_revenue)
    : (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val);

  const expectedProfit = contract.admin_profit !== null && contract.admin_profit !== undefined
    ? Number(contract.admin_profit)
    : expectedRevenue - estimatedCost;

  const revenuePayments = payments.filter(
    (p) => p.voucher_type === 'VAT_INVOICE' &&
      ['Đã xuất HĐ', 'Đã giao KH', 'Tiền về', 'Paid'].includes(p.status) &&
      isInPeriodFn(p.invoice_date || p.payment_date)
  );

  let revenueInPeriod = 0;
  revenuePayments.forEach((p) => {
    if (p.vat_invoice_items && p.vat_invoice_items.length > 0) {
      revenueInPeriod += p.vat_invoice_items.reduce((s, item) => s + (Number(item.amountBeforeVAT) || 0), 0);
    } else {
      const gross = Number(p.amount) || 0;
      const vatDivisor = hasVat && vatRate > 0 ? (1 + vatRate / 100) : 1;
      revenueInPeriod += Math.round(gross / vatDivisor);
    }
  });

  const cashPayments = payments.filter(
    (p) => p.voucher_type === 'RECEIPT' &&
      ['Tạm ứng', 'Tiền về', 'Paid'].includes(p.status) &&
      isInPeriodFn(p.payment_date)
  );
  const cashInPeriod = cashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  let revProfitInPeriod = 0;
  if (expectedRevenue > 0) {
    const profitRatio = expectedProfit / expectedRevenue;
    revProfitInPeriod = revenueInPeriod * profitRatio;
  }

  return {
    revenueInPeriod,
    cashInPeriod,
    revProfitInPeriod
  };
};

async function run() {
  const email = env['VITE_DEV_EMAIL'] || 'appdev@cic.com.vn';
  const password = env['VITE_DEV_PASSWORD'] || 'Abc123456';
  await supabase.auth.signInWithPassword({ email, password });

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, value, expected_revenue, estimated_cost, status, unit_id, unit_allocations, end_date, signed_date, vat_rate, has_vat, admin_profit, rev_profit, payments(amount, paid_amount, status, payment_type, voucher_type, payment_date, invoice_date, vat_invoice_items)');

  if (error) {
    console.error(error);
    return;
  }

  // Chạy logic getStatsFallback của toàn công ty
  const totals = contracts.reduce((acc, curr) => {
    // Với toàn công ty, sharePct = 100%
    const fraction = 1;
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
    
    const { revenueInPeriod, cashInPeriod } = calculatePeriodFinancials(curr, isInPeriod);
    
    acc.totalRevenue += revenueInPeriod * fraction;
    acc.totalCash += cashInPeriod * fraction;

    return acc;
  }, { totalContracts: 0, totalValue: 0, totalRevenue: 0, totalProfit: 0, totalSigningProfit: 0, totalCash: 0, activeCount: 0, pendingCount: 0, completedCount: 0, expiredCount: 0, processingCount: 0, acceptanceCount: 0, suspendedCount: 0, handoverCount: 0 });

  console.log("=========================================");
  console.log("SỐ LIỆU ĐÚNG TỔNG HỢP TOÀN CÔNG TY NĂM 2026 (Theo logic Dashboard chính):");
  console.log("Tổng Ký kết (tổng value các HĐ ký 2026):", (totals.totalValue / 1e9).toFixed(2) + " tỷ VND");
  console.log("Tổng Doanh thu (tổng VAT invoice preVatAmount phát sinh 2026):", (totals.totalRevenue / 1e9).toFixed(2) + " tỷ VND");
  console.log("Tổng Dòng tiền (tổng RECEIPT phát sinh 2026):", (totals.totalCash / 1e9).toFixed(2) + " tỷ VND");
  console.log("Tổng Lợi nhuận QT:", (totals.totalProfit / 1e9).toFixed(2) + " tỷ VND");
  console.log("Tổng Công nợ (Doanh thu - Dòng tiền):", ((totals.totalRevenue - totals.totalCash) / 1e9).toFixed(2) + " tỷ VND");
  console.log("Hợp đồng quá hạn (expiredCount):", totals.expiredCount);
  console.log("Tổng số hợp đồng ký trong năm (totalContracts):", totals.totalContracts);
  console.log("=========================================");
}

run();
