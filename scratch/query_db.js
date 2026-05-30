import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Tự parse file .env.local
const envLocal = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

console.log("Supabase URL:", supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("\n=== TRUY VẤN DỮ LIỆU THỰC TẾ ===");
  
  // 1. Lấy tất cả hợp đồng
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, title, value, actual_revenue, signed_date, status');
    
  if (error) {
    console.error("Lỗi:", error);
    return;
  }
  
  console.log(`Tổng số hợp đồng trong DB: ${contracts?.length}`);
  
  // 2. Thống kê theo năm
  const stats = {};
  (contracts || []).forEach(c => {
    if (!c.signed_date) return;
    const year = new Date(c.signed_date).getFullYear();
    if (!stats[year]) {
      stats[year] = { count: 0, totalValue: 0, totalRevenue: 0 };
    }
    stats[year].count++;
    stats[year].totalValue += c.value || 0;
    stats[year].totalRevenue += c.actual_revenue || 0;
  });
  
  console.log("\nThống kê theo năm:");
  console.table(
    Object.entries(stats).map(([year, data]) => ({
      "Năm": year,
      "Số HĐ": data.count,
      "Ký kết (VND)": data.totalValue.toLocaleString('vi-VN'),
      "Doanh thu (VND)": data.totalRevenue.toLocaleString('vi-VN')
    }))
  );
  
  // 3. Chi tiết các hợp đồng ký năm 2026
  const c2026 = (contracts || []).filter(c => c.signed_date && new Date(c.signed_date).getFullYear() === 2026);
  console.log(`\nDanh sách hợp đồng năm 2026 (Tổng cộng ${c2026.length} HĐ):`);
  console.table(
    c2026.map(c => ({
      "Tên hợp đồng": c.title?.substring(0, 40),
      "Ngày ký": c.signed_date,
      "Trạng thái": c.status,
      "Giá trị (VND)": (c.value || 0).toLocaleString('vi-VN'),
      "Doanh thu (VND)": (c.actual_revenue || 0).toLocaleString('vi-VN')
    }))
  );
}

run();
