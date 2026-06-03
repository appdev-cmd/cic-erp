import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Tự parse file .env.local và .env
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

parseEnvFile('.env');
parseEnvFile('.env.local');

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];
const email = env['VITE_DEV_EMAIL'] || 'appdev@cic.com.vn';
const password = env['VITE_DEV_PASSWORD'] || 'Abc123456';

const supabase = createClient(supabaseUrl, supabaseKey);

// Giả lập hàm getUnitSharePct
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

// Giả lập isInPeriod cho cả năm 2026
const isInPeriod = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= new Date('2026-01-01T00:00:00') && d <= new Date('2026-12-31T23:59:59');
};

// Giả lập calculatePeriodFinancials
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
  console.log("=== ĐĂNG NHẬP ===");
  await supabase.auth.signInWithPassword({ email, password });
  
  console.log("\n=== GIẢ LẬP TÍNH TOÁN GET_WITH_STATS CỦA UNIT_SERVICE ===");
  
  // 1. Lấy tất cả đơn vị
  const { data: units } = await supabase.from('units').select('*');
  
  // 2. Lấy tất cả hợp đồng cùng payments
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, value, expected_revenue, admin_profit, estimated_cost, status, unit_id, unit_allocations, signed_date, vat_rate, has_vat, payments(amount, paid_amount, status, payment_type, voucher_type, payment_date, invoice_date, vat_invoice_items)');
    
  if (error) {
    console.error("Lỗi:", error);
    return;
  }
  
  console.log(`Lấy được ${contracts.length} hợp đồng từ DB.`);
  
  // 3. Tính toán thống kê cho từng đơn vị giống hệt unitService.ts
  const results = (units || []).map(u => {
    let contractCount = 0;
    let totalSigning = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalRevenueProfit = 0;
    let totalCash = 0;

    contracts.forEach((c) => {
      const sharePct = getUnitSharePct(c, u.id);
      if (sharePct === 0) return;

      const fraction = sharePct / 100;
      const val = c.value || 0;
      const estimatedCost = c.estimated_cost || 0;
      const hasVat = c.has_vat !== false;
      const vatRate = c.vat_rate ?? 10;

      const expectedRevenue = c.expected_revenue !== null && c.expected_revenue !== undefined
        ? Number(c.expected_revenue)
        : (hasVat && vatRate > 0 ? Math.round(val / (1 + vatRate / 100)) : val);

      const expectedProfit = c.admin_profit !== null && c.admin_profit !== undefined
        ? Number(c.admin_profit)
        : expectedRevenue - estimatedCost;

      // Signing Metrics
      if (isInPeriod(c.signed_date)) {
        contractCount++;
        totalSigning += val * fraction;
        totalProfit += expectedProfit * fraction;
      }

      // Revenue and Cash Metrics
      const { revenueInPeriod, cashInPeriod, revProfitInPeriod } = calculatePeriodFinancials(c, isInPeriod);

      totalRevenue += revenueInPeriod * fraction;
      totalCash += cashInPeriod * fraction;
      totalRevenueProfit += revProfitInPeriod * fraction;
    });

    return {
      name: u.name,
      contractCount,
      totalSigning,
      totalRevenue,
      totalCash,
      totalProfit
    };
  });
  
  console.log("\nKết quả tính toán JS Aggregation:");
  console.table(
    results.map(r => ({
      "Đơn vị": r.name,
      "Số HĐ": r.contractCount,
      "Ký kết (VND)": r.totalSigning.toLocaleString('vi-VN'),
      "Doanh thu (VND)": r.totalRevenue.toLocaleString('vi-VN'),
      "Dòng tiền (VND)": r.totalCash.toLocaleString('vi-VN'),
      "Lợi nhuận (VND)": r.totalProfit.toLocaleString('vi-VN')
    }))
  );
  
  const sumSigning = results.reduce((s, r) => s + r.totalSigning, 0);
  console.log("\nTỔNG CỘNG KÝ KẾT JS AGGREGATION:", sumSigning.toLocaleString('vi-VN'));
}

run();
