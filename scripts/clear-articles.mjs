/**
 * Xóa TOÀN BỘ tin bài đã crawl để cào lại từ đầu.
 *
 * - Xóa hết tech_articles (kéo theo cascade: tech_bookmarks, tech_report_articles).
 * - Reset bộ đếm nguồn tin (article_count = 0, last_crawled_at = null) — KHÔNG xóa nguồn.
 *
 * Usage: node scripts/clear-articles.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ─── Đọc env từ .env / .env.local ────────────────────
function loadEnv(path) {
  try {
    for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) {
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  } catch { /* ignore */ }
}
loadEnv('.env');
loadEnv('.env.local');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_SERVICE_ROLE_KEY trong .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log('=== Xóa toàn bộ tin bài để cào lại ===\n');

  // 1. Đếm trước khi xóa
  const { count: before, error: countErr } = await supabase
    .from('tech_articles')
    .select('*', { count: 'exact', head: true });
  if (countErr) {
    console.error('❌ Lỗi đếm bài viết:', countErr.message);
    process.exit(1);
  }
  console.log(`[1/3] Hiện có ${before ?? 0} bài viết.`);

  if (!before) {
    console.log('  → Không có bài nào để xóa.');
  } else {
    // 2. Xóa tất cả (điều kiện luôn đúng để xóa toàn bộ)
    console.log('[2/3] Đang xóa...');
    const { error: delErr } = await supabase
      .from('tech_articles')
      .delete()
      .not('id', 'is', null);
    if (delErr) {
      console.error('❌ Lỗi xóa:', delErr.message);
      process.exit(1);
    }
    const { count: after } = await supabase
      .from('tech_articles')
      .select('*', { count: 'exact', head: true });
    console.log(`  → Đã xóa. Còn lại: ${after ?? 0} bài.`);
  }

  // 3. Reset bộ đếm nguồn tin
  console.log('[3/3] Reset bộ đếm nguồn tin...');
  const { error: srcErr } = await supabase
    .from('tech_sources')
    .update({ article_count: 0, last_crawled_at: null })
    .not('id', 'is', null);
  if (srcErr) {
    console.warn('  ⚠ Không reset được nguồn tin:', srcErr.message);
  } else {
    console.log('  → Đã reset article_count = 0, last_crawled_at = null cho mọi nguồn.');
  }

  console.log('\n=== Hoàn tất. Bạn có thể bấm "Crawl tất cả" để cào lại. ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
