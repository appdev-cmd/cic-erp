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

async function run() {
  const email = env['VITE_DEV_EMAIL'] || 'appdev@cic.com.vn';
  const password = env['VITE_DEV_PASSWORD'] || 'Abc123456';
  await supabase.auth.signInWithPassword({ email, password });
  
  // Lấy toàn bộ contracts
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, signed_date, status, end_date, value, expected_revenue, admin_profit, estimated_cost, unit_id, unit_allocations, payments(amount, paid_amount, status, payment_type, voucher_type, payment_date, invoice_date, vat_invoice_items)');
    
  if (error) {
    console.error("Lỗi:", error);
    return;
  }
  
  console.log("Tổng số hợp đồng trong DB:", contracts.length);
  
  const today = new Date().toISOString().split('T')[0];
  
  // 1. Đếm hợp đồng có signed_date trong năm 2026
  const contracts2026 = contracts.filter(c => c.signed_date && c.signed_date.startsWith('2026'));
  console.log("Số hợp đồng ký năm 2026:", contracts2026.length);
  
  // 2. Đếm hợp đồng quá hạn thực tế (end_date < today và status = 'Processing')
  const overdueContracts = contracts.filter(c => c.status === 'Processing' && c.end_date && c.end_date < today);
  console.log("Hợp đồng quá hạn thực tế (status = Processing và end_date < today):", overdueContracts.length);
  console.log("Danh sách ID HĐ quá hạn:", overdueContracts.map(c => c.id));
  
  // 3. Đếm hợp đồng quá hạn theo logic Processing/Acceptance
  const overdueContracts2 = contracts.filter(c => ['Processing', 'Acceptance'].includes(c.status) && c.end_date && c.end_date < today);
  console.log("Hợp đồng quá hạn theo logic Processing/Acceptance và end_date < today:", overdueContracts2.length);

  // 4. Đếm payments quá hạn
  let overduePaymentsCount = 0;
  contracts.forEach(c => {
    const payments = c.payments || [];
    const overduePay = payments.filter(p => 
      ['RECEIPT', 'VAT_INVOICE'].includes(p.voucher_type) &&
      ['Chưa thanh toán', 'Pending', 'Chờ thanh toán'].includes(p.status) &&
      p.due_date && p.due_date < today
    );
    overduePaymentsCount += overduePay.length;
  });
  console.log("Số payments quá hạn:", overduePaymentsCount);
}

run();
