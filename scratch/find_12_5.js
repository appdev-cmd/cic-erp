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

  console.log("=== TÌM KIẾM GIÁ TRỊ 12.5M TRONG BẢNG CONTRACTS ===");
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, name, value, expected_revenue, admin_profit, estimated_cost, signed_date, unit_id')
    .or('value.eq.12500000,expected_revenue.eq.12500000,admin_profit.eq.12500000,estimated_cost.eq.12500000');
    
  console.log(`Tìm được ${contracts?.length || 0} hợp đồng có giá trị 12.5M.`);
  if (contracts && contracts.length > 0) {
    console.log(JSON.stringify(contracts, null, 2));
  }

  console.log("\n=== TÌM KIẾM GIÁ TRỊ 12.5M TRONG BẢNG PAYMENTS ===");
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, paid_amount, status, voucher_type, contract_id')
    .or('amount.eq.12500000,paid_amount.eq.12500000');

  console.log(`Tìm được ${payments?.length || 0} payments có giá trị 12.5M.`);
  if (payments && payments.length > 0) {
    console.log(JSON.stringify(payments, null, 2));
  }
  
  console.log("\n=== TỔNG QUÉT TẤT CẢ CONTRACTS CÓ GIÁ TRỊ NHỎ < 100M ===");
  const { data: allSmall } = await supabase
    .from('contracts')
    .select('id, name, value, signed_date, status')
    .lt('value', 100000000);
  console.log(`Tìm được ${allSmall?.length || 0} hợp đồng nhỏ hơn 100M.`);
  console.table(allSmall?.map(c => ({ id: c.id, name: c.name, value: c.value.toLocaleString('vi-VN'), date: c.signed_date })));
}

run();
