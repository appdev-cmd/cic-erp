import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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

async function run() {
  await supabase.auth.signInWithPassword({ email, password });

  console.log("\n=== TÍNH TOÁN STATS CẢ NĂM 2026 VÀ TỪNG THÁNG ===");
  
  // Lấy tất cả hợp đồng cùng payments
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, value, expected_revenue, admin_profit, estimated_cost, status, unit_id, signed_date, vat_rate, has_vat, payments(amount, paid_amount, status, payment_type, voucher_type, payment_date, invoice_date, vat_invoice_items)');

  const getUnitSharePct = (c) => 100; // Giả sử lấy toàn công ty (tổng)

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

  // Test từng tháng trong năm 2026
  for (let m = 1; m <= 12; m++) {
    const start = new Date(2026, m - 1, 1);
    const end = new Date(2026, m, 0, 23, 59, 59);
    
    const isInPeriod = (dStr) => {
      if (!dStr) return false;
      const d = new Date(dStr);
      return d >= start && d <= end;
    };

    let contractCount = 0;
    let totalSigning = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalRevenueProfit = 0;
    let totalCash = 0;

    (contracts || []).forEach((c) => {
      const fraction = 1.0;
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

      if (isInPeriod(c.signed_date)) {
        contractCount++;
        totalSigning += val * fraction;
        totalProfit += expectedProfit * fraction;
      }

      const { revenueInPeriod, cashInPeriod, revProfitInPeriod } = calculatePeriodFinancials(c, isInPeriod);

      totalRevenue += revenueInPeriod * fraction;
      totalCash += cashInPeriod * fraction;
      totalRevenueProfit += revProfitInPeriod * fraction;
    });

    console.log(`Tháng ${m}/2026: HĐ=${contractCount}, Ký kết=${totalSigning.toLocaleString('vi-VN')}, Doanh thu=${totalRevenue.toLocaleString('vi-VN')}, Dòng tiền=${totalCash.toLocaleString('vi-VN')}`);
  }
}

run();
