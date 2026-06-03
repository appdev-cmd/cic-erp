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
  console.log("=== ĐĂNG NHẬP ===");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error("Đăng nhập thất bại:", authError);
    return;
  }
  const user = authData.user;
  console.log("Đăng nhập thành công! User ID:", user.id);

  console.log("\n=== TỔNG HỢP CONTRACTS THEO NĂM ===");
  const { data: contracts, error: contrError } = await supabase
    .from('contracts')
    .select('id, value, signed_date');

  if (contrError) {
    console.error("Lỗi:", contrError);
  } else {
    const statsByYear = {};
    contracts.forEach(c => {
      if (c.signed_date) {
        const year = new Date(c.signed_date).getFullYear();
        if (!statsByYear[year]) {
          statsByYear[year] = { count: 0, sum: 0 };
        }
        statsByYear[year].count++;
        statsByYear[year].sum += Number(c.value) || 0;
      }
    });
    console.log("Thống kê hợp đồng ký kết theo năm:");
    console.table(
      Object.entries(statsByYear).map(([year, data]) => ({
        "Năm": year,
        "Số HĐ": data.count,
        "Tổng giá trị (VND)": data.sum.toLocaleString('vi-VN')
      }))
    );
  }
}

run();
