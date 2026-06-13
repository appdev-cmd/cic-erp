/**
 * Verify tech_intel tables exist after migration
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jyohocjsnsyfgfsmjfqx.supabase.co';
const ANON_KEY = 'sb_publishable_qsfBWi9EC4HudNWcnY7A1Q_14li_aL9';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false }
});

async function verify() {
  console.log('🔍 Verifying ConTech Intelligence Hub tables...\n');

  const tables = [
    { name: 'tech_sources', label: 'Nguồn tin RSS' },
    { name: 'tech_articles', label: 'Bài viết công nghệ' },
    { name: 'tech_reports', label: 'Báo cáo tổng hợp' },
    { name: 'tech_report_articles', label: 'Liên kết báo cáo-bài viết' },
    { name: 'tech_bookmarks', label: 'Đánh dấu bài viết' },
    { name: 'tech_taxonomy', label: 'Phân loại taxonomy' },
  ];

  let allOk = true;

  for (const t of tables) {
    const { data, error, count } = await supabase
      .from(t.name)
      .select('*', { count: 'exact', head: false })
      .limit(1);

    if (error) {
      console.log(`  ❌ ${t.name} (${t.label}) — ${error.message}`);
      allOk = false;
    } else {
      console.log(`  ✅ ${t.name} (${t.label}) — OK (${count ?? data?.length ?? 0} rows)`);
    }
  }

  console.log(allOk ? '\n🎉 Tất cả tables đã sẵn sàng!' : '\n⚠️ Một số tables gặp lỗi.');
}

verify().catch(err => {
  console.error('❌ Error:', err.message);
});
