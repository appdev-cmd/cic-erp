import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({path:'.env.local'});

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log("=== THỐNG KÊ HỢP ĐỒNG TRONG DATABASE ===");
  
  // 1. Lấy tất cả hợp đồng
  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('id, title, value, actual_revenue, signed_date, status');
    
  if (error) {
    console.error("Lỗi truy vấn hợp đồng:", error);
    return;
  }
  
  console.log(`Tìm thấy tổng cộng: ${contracts?.length} hợp đồng.`);
  
  // 2. Gom nhóm theo năm ký kết
  const statsByYear: Record<number, { count: number; totalValue: number; totalRevenue: number }> = {};
  
  (contracts || []).forEach(c => {
    if (!c.signed_date) return;
    const year = new Date(c.signed_date).getFullYear();
    if (!statsByYear[year]) {
      statsByYear[year] = { count: 0, totalValue: 0, totalRevenue: 0 };
    }
    statsByYear[year].count++;
    statsByYear[year].totalValue += c.value || 0;
    statsByYear[year].totalRevenue += c.actual_revenue || 0;
  });
  
  console.log("\nSố liệu tổng hợp theo năm ký kết trong DB:");
  console.table(
    Object.entries(statsByYear).map(([year, data]) => ({
      "Năm": year,
      "Số hợp đồng": data.count,
      "Tổng giá trị ký kết (VND)": data.totalValue.toLocaleString('vi-VN'),
      "Tổng doanh thu (VND)": data.totalRevenue.toLocaleString('vi-VN')
    }))
  );
  
  // 3. Chi tiết 10 hợp đồng gần nhất
  console.log("\nChi tiết 10 hợp đồng gần nhất:");
  console.table(
    contracts?.slice(0, 10).map(c => ({
      "Tên hợp đồng": c.title?.substring(0, 30),
      "Ngày ký": c.signed_date,
      "Trạng thái": c.status,
      "Giá trị (VND)": (c.value || 0).toLocaleString('vi-VN'),
      "Doanh thu (VND)": (c.actual_revenue || 0).toLocaleString('vi-VN')
    }))
  );
}

run();
