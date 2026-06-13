import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual env loading
function loadEnv(p: string) {
  try {
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Nguồn RSS chất lượng cao
const RSS_SOURCES = [
  { name: 'Dezeen', url: 'https://www.dezeen.com/feed/', type: 'rss', language: 'en', country: 'GB', category: 'architecture' },
  { name: 'PBC Today', url: 'https://www.pbctoday.co.uk/news/feed/', type: 'rss', language: 'en', country: 'GB', category: 'construction' },
  { name: 'Global Construction Review', url: 'https://www.globalconstructionreview.com/feed/', type: 'rss', language: 'en', country: 'GB', category: 'construction' },
  { name: 'Construction Enquirer', url: 'https://www.constructionenquirer.com/feed/', type: 'rss', language: 'en', country: 'GB', category: 'construction' },
  { name: 'Construction Physics', url: 'https://www.construction-physics.com/feed', type: 'rss', language: 'en', country: 'US', category: 'analysis' },
  { name: 'Construction Management (CIOB)', url: 'https://constructionmanagement.co.uk/feed/', type: 'rss', language: 'en', country: 'GB', category: 'construction' },
  { name: 'ArchDaily', url: 'https://www.archdaily.com/rss/', type: 'rss', language: 'en', country: 'US', category: 'architecture' },
  { name: 'Smart Cities Dive', url: 'https://www.smartcitiesdive.com/feeds/news/', type: 'rss', language: 'en', country: 'US', category: 'smart_city' },
  { name: 'Construction Week Online', url: 'https://www.constructionweekonline.com/feed', type: 'rss', language: 'en', country: 'AE', category: 'construction' },
  { name: 'Construction Dive', url: 'https://www.constructiondive.com/feeds/news/', type: 'rss', language: 'en', country: 'US', category: 'construction' },
  { name: 'Autodesk Blog', url: 'https://blogs.autodesk.com/feed/', type: 'rss', language: 'en', country: 'US', category: 'bim' },
  { name: 'BuildingSMART News', url: 'https://www.buildingsmart.org/feed/', type: 'rss', language: 'en', country: 'US', category: 'bim' },
  { name: 'Daily Commercial News', url: 'https://canada.constructconnect.com/dcn/feed', type: 'rss', language: 'en', country: 'CA', category: 'construction' }
];

// 2. Nguồn Web / Deep Crawl (Sử dụng type: 'web' thay vì 'deep_crawl' để tương thích với db constraint)
const WEB_SOURCES = [
  {
    name: 'Autodesk Construction Blog',
    url: 'https://www.autodesk.com/blogs/construction',
    type: 'web',
    language: 'en',
    country: 'US',
    category: 'bim',
    config: { maxDepth: 2, maxPages: 30, includePatterns: ['/blogs/construction/'], jsEnabled: true, stealthMode: true, contentFilter: 'pruning' }
  },
  {
    name: 'Bentley Systems News',
    url: 'https://www.bentley.com/news',
    type: 'web',
    language: 'en',
    country: 'US',
    category: 'infrastructure',
    config: { maxDepth: 2, maxPages: 30, includePatterns: ['/news/', '/press-releases/'], jsEnabled: true, stealthMode: true, contentFilter: 'pruning' }
  },
  {
    name: 'Trimble Resources',
    url: 'https://www.trimble.com/en/resources/news',
    type: 'web',
    language: 'en',
    country: 'US',
    category: 'contech',
    config: { maxDepth: 2, maxPages: 30, includePatterns: ['/resources/'], jsEnabled: true, stealthMode: true, contentFilter: 'pruning' }
  },
  {
    name: 'Procore Blog',
    url: 'https://www.procore.com/blog',
    type: 'web',
    language: 'en',
    country: 'US',
    category: 'project_management',
    config: { maxDepth: 2, maxPages: 30, includePatterns: ['/blog/'], jsEnabled: true, stealthMode: true, contentFilter: 'pruning' }
  },
  {
    name: 'Hexagon Newsroom',
    url: 'https://hexagon.com/newsroom',
    type: 'web',
    language: 'en',
    country: 'US',
    category: 'geospatial',
    config: { maxDepth: 2, maxPages: 30, includePatterns: ['/newsroom/'], jsEnabled: true, stealthMode: true, contentFilter: 'pruning' }
  },
  {
    name: 'Built Robotics News',
    url: 'https://www.builtrobotics.com/news',
    type: 'web',
    language: 'en',
    country: 'US',
    category: 'robotics',
    config: { maxDepth: 1, maxPages: 20, includePatterns: ['/news/'], jsEnabled: true, stealthMode: false, contentFilter: 'pruning' }
  },
  {
    name: 'OpenSpace Blog',
    url: 'https://www.openspace.ai/blog',
    type: 'web',
    language: 'en',
    country: 'US',
    category: 'reality_capture',
    config: { maxDepth: 2, maxPages: 20, includePatterns: ['/blog/'], jsEnabled: true, stealthMode: false, contentFilter: 'pruning' }
  },
  {
    name: 'PlanRadar Blog',
    url: 'https://www.planradar.com/blog',
    type: 'web',
    language: 'en',
    country: 'US',
    category: 'field_management',
    config: { maxDepth: 2, maxPages: 20, includePatterns: ['/blog/'], jsEnabled: true, stealthMode: false, contentFilter: 'pruning' }
  }
];

async function main() {
  console.log('=== CHUẨN HOÁ VÀ KÍCH HOẠT TOÀN BỘ NGUỒN CÀO ===\n');

  // 1. Thêm/Cập nhật nguồn RSS
  console.log('[1/4] Đang xử lý các nguồn RSS...');
  for (const src of RSS_SOURCES) {
    const { error } = await supabase.from('tech_sources').upsert({
      name: src.name,
      url: src.url,
      type: src.type,
      language: src.language,
      country: src.country,
      category: src.category,
      is_active: true,
      article_count: 0,
      last_crawled_at: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'url' });

    if (error) {
      console.error(`  ❌ Lỗi upsert RSS ${src.name}:`, error.message);
    } else {
      console.log(`  ✅ RSS: ${src.name} -> Hoạt động`);
    }
  }

  // 2. Thêm/Cập nhật nguồn Web/Deep Crawl (dưới dạng type: 'web')
  console.log('\n[2/4] Đang xử lý các nguồn Web (Deep Crawl)...');
  for (const src of WEB_SOURCES) {
    const { error } = await supabase.from('tech_sources').upsert({
      name: src.name,
      url: src.url,
      type: src.type,
      language: src.language,
      country: src.country,
      category: src.category,
      config: src.config,
      is_active: true,
      article_count: 0,
      last_crawled_at: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'url' });

    if (error) {
      console.error(`  ❌ Lỗi upsert Web ${src.name}:`, error.message);
    } else {
      console.log(`  ✅ Web (Deep): ${src.name} -> Hoạt động`);
    }
  }

  // 3. Kích hoạt toàn bộ nguồn Google News đang có sẵn trong DB
  console.log('\n[3/4] Kích hoạt và reset các nguồn Google News có sẵn...');
  const { data: gSources, error: gError } = await supabase
    .from('tech_sources')
    .update({
      is_active: true,
      article_count: 0,
      last_crawled_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('type', 'google_news')
    .select('name');

  if (gError) {
    console.error('  ❌ Lỗi kích hoạt Google News:', gError.message);
  } else {
    console.log(`  ✅ Đã kích hoạt và reset ${gSources?.length || 0} nguồn Google News.`);
    gSources?.forEach(s => console.log(`     - ${s.name}`));
  }

  // 4. In ra tổng kết số lượng nguồn hoạt động
  console.log('\n[4/4] Kiểm tra trạng thái hiện tại của toàn bộ nguồn...');
  const { data: allSources, error: allErr } = await supabase
    .from('tech_sources')
    .select('id, name, type, is_active');

  if (allErr) {
    console.error('  ❌ Lỗi tải danh sách nguồn:', allErr.message);
  } else {
    console.log(`\nTổng số nguồn cào trong DB: ${allSources?.length}`);
    const activeCount = allSources?.filter(s => s.is_active).length || 0;
    console.log(`Số nguồn đang HOẠT ĐỘNG (is_active = true): ${activeCount}/${allSources?.length}`);
    
    console.log('\nPhân bổ nguồn theo Type:');
    const typeStats: Record<string, { total: number; active: number }> = {};
    allSources?.forEach(s => {
      if (!typeStats[s.type]) typeStats[s.type] = { total: 0, active: 0 };
      typeStats[s.type].total++;
      if (s.is_active) typeStats[s.type].active++;
    });
    console.table(typeStats);
  }

  console.log('\n=== Hoàn tất chuẩn hoá các nguồn cào dữ liệu! ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
