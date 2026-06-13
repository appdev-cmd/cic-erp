import '../setup-env.ts';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Thiếu cấu hình Supabase URL hoặc Service Role Key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('Bắt đầu xóa toàn bộ tin tức và báo cáo...');
  try {
    // 1. Xóa liên kết tech_report_articles
    const { error: err1 } = await supabase.from('tech_report_articles').delete().neq('report_id', '00000000-0000-0000-0000-000000000000');
    if (err1) console.warn('Lỗi xóa tech_report_articles:', err1.message);

    // 2. Xóa tech_bookmarks
    const { error: err2 } = await supabase.from('tech_bookmarks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err2) console.warn('Lỗi xóa tech_bookmarks:', err2.message);

    // 3. Xóa tech_articles (CASCADE sẽ tự dọn các liên kết còn lại nếu có)
    const { error: err3 } = await supabase.from('tech_articles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err3) {
      console.error('Lỗi xóa tech_articles:', err3.message);
    } else {
      console.log('Xóa thành công toàn bộ tech_articles.');
    }

    // 4. Xóa tech_reports
    const { error: err4 } = await supabase.from('tech_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err4) {
      console.error('Lỗi xóa tech_reports:', err4.message);
    } else {
      console.log('Xóa thành công toàn bộ tech_reports.');
    }

    // 5. Reset số lượng bài viết (article_count) trên các nguồn tin tech_sources
    const { error: err5 } = await supabase.from('tech_sources').update({ article_count: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (err5) {
      console.warn('Lỗi reset article_count trên tech_sources:', err5.message);
    } else {
      console.log('Đã reset article_count = 0 trên toàn bộ nguồn tin (tech_sources).');
    }

    console.log('Hoàn thành dọn dẹp toàn bộ dữ liệu ConTech Hub!');
  } catch (error: any) {
    console.error('Lỗi dọn dẹp:', error.message || error);
  } finally {
    process.exit(0);
  }
}

main();
