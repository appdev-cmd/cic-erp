/**
 * Áp dụng đổi nguồn (Google News → RSS trực tiếp) + crawl tất cả nguồn active,
 * NGAY TẠI MÁY (không cần deploy). Dùng lại fetchRSS/scrapeArticlePage thật.
 *
 * Usage: npx tsx scripts/refresh-and-crawl.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fetchRSS, isSpamOrJunk, scrapeArticlePage } from '../api/tech-intel/crawl';

function loadEnv(p: string) {
  try { for (const l of fs.readFileSync(p, 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i > 0) { const k = t.slice(0, i).trim(); if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, ''); } } } catch { /* */ }
}
loadEnv('.env'); loadEnv('.env.local');

const sb = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const CURATED = [
  ['Dezeen', 'https://www.dezeen.com/feed/', 'en', 'GB', 'architecture'],
  ['PBC Today', 'https://www.pbctoday.co.uk/news/feed/', 'en', 'GB', 'construction'],
  ['Global Construction Review', 'https://www.globalconstructionreview.com/feed/', 'en', 'GB', 'construction'],
  ['Construction Enquirer', 'https://www.constructionenquirer.com/feed/', 'en', 'GB', 'construction'],
  ['Construction Physics', 'https://www.construction-physics.com/feed', 'en', 'US', 'analysis'],
  ['Construction Management (CIOB)', 'https://constructionmanagement.co.uk/feed/', 'en', 'GB', 'construction'],
  ['ArchDaily', 'https://www.archdaily.com/rss/', 'en', 'US', 'architecture'],
  ['Smart Cities Dive', 'https://www.smartcitiesdive.com/feeds/news/', 'en', 'US', 'smart_city'],
  ['Construction Week Online', 'https://www.constructionweekonline.com/feed', 'en', 'AE', 'construction'],
];
const SEED_RSS = [
  'https://www.constructiondive.com/feeds/news/',
  'https://blogs.autodesk.com/feed/',
  'https://www.buildingsmart.org/feed/',
  'https://canada.constructconnect.com/dcn/feed',
];

async function refreshSources() {
  console.log('[1] Đổi nguồn...');
  await sb.from('tech_sources').update({ is_active: false, updated_at: new Date().toISOString() }).eq('type', 'google_news');
  for (const [name, url, language, country, category] of CURATED) {
    await sb.from('tech_sources').upsert(
      { name, url, type: 'rss', language, country, category, is_active: true, updated_at: new Date().toISOString() },
      { onConflict: 'url' },
    );
  }
  await sb.from('tech_sources').update({ is_active: true }).in('url', SEED_RSS);
  console.log('   → Đã tắt Google News, kích hoạt nguồn RSS trực tiếp.');
}

async function crawl() {
  const { data: sources } = await sb.from('tech_sources').select('*').eq('is_active', true);
  console.log(`\n[2] Crawl ${sources?.length || 0} nguồn active...\n`);
  let totalNew = 0, totalScraped = 0;

  for (const s of sources || []) {
    try {
      const articles = await fetchRSS(s.url);
      const clean = articles.filter(a => !isSpamOrJunk(a.title, a.url));
      const rows = clean.map(a => {
        let summary = a.summary || null;
        if (summary) {
          const nt = a.title.replace(/\s+/g, '').toLowerCase();
          const ns = summary.replace(/\s+/g, '').toLowerCase();
          if (ns === nt || ns.startsWith(nt) || nt.startsWith(ns)) summary = null;
        }
        return { title: a.title, url: a.url, source_id: s.id, summary, content: a.content || null, thumbnail_url: a.thumbnailUrl, published_at: a.publishedAt, language: s.language || 'en', status: 'pending' };
      });
      const { data: inserted, error } = await sb.from('tech_articles').upsert(rows, { onConflict: 'url', ignoreDuplicates: true }).select('id, url, title, summary, content');
      if (error) { console.log(`  ❌ ${s.name}: ${error.message}`); continue; }
      const n = inserted?.length || 0;
      totalNew += n;

      // Cào content cho bài còn thiếu (URL gốc thật)
      const toScrape = (inserted || []).filter((a: any) => !a.url.includes('news.google.com') && (!a.content || a.content.length < 200)).slice(0, 15);
      let sc = 0;
      for (let i = 0; i < toScrape.length; i += 3) {
        await Promise.allSettled(toScrape.slice(i, i + 3).map(async (a: any) => {
          const d = await scrapeArticlePage(a.url, a.title, a.summary);
          if (d && Object.keys(d).length) { await sb.from('tech_articles').update(d).eq('id', a.id); sc++; }
        }));
      }
      totalScraped += sc;
      console.log(`  ✅ ${s.name.padEnd(30)} +${n} bài (cào ${sc})`);

      await sb.from('tech_sources').update({ last_crawled_at: new Date().toISOString(), article_count: (s.article_count || 0) + n }).eq('id', s.id);
    } catch (e: any) {
      console.log(`  ❌ ${s.name}: ${e.message}`);
    }
  }
  console.log(`\n=== Crawl xong: ${totalNew} bài mới, cào content ${totalScraped} bài ===`);
}

async function main() {
  await refreshSources();
  await crawl();
  console.log('\n→ Tiếp theo: npx tsx scripts/process-pending.ts để phân tích AI.');
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
