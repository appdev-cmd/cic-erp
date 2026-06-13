import '../setup-env.ts';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Thiếu cấu hình Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  try {
    // 1. Tìm một nguồn Google News active
    const { data: sources, error: srcErr } = await supabase
      .from('tech_sources')
      .select('id, name, url')
      .eq('is_active', true)
      .like('name', 'Google News%')
      .limit(1);
      
    if (srcErr) throw srcErr;
    if (!sources || sources.length === 0) {
      console.log('Không tìm thấy nguồn Google News active nào.');
      process.exit(0);
    }
    
    const source = sources[0];
    console.log(`Selected Google News Source: ${source.name} (ID: ${source.id})`);
    
    // 2. Gọi API cào duy nhất nguồn này
    console.log(`Triggering crawl for source ${source.name}...`);
    const crawlRes = await fetch('http://localhost:3000/api/tech-intel/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: source.id })
    });
    
    if (!crawlRes.ok) {
      throw new Error(`Crawl API failed: ${crawlRes.status} ${await crawlRes.text()}`);
    }
    
    const crawlResult = await crawlRes.json();
    console.log('Crawl API Result:', crawlResult);
    
    // 3. Lấy ra một bài viết pending của nguồn này
    const { data: articles, error: artErr } = await supabase
      .from('tech_articles')
      .select('id, title, url, summary, status')
      .eq('source_id', source.id)
      .eq('status', 'pending')
      .limit(1);
      
    if (artErr) throw artErr;
    if (!articles || articles.length === 0) {
      console.log(`Không tìm thấy bài viết pending nào của nguồn ${source.name} vừa cào.`);
      process.exit(0);
    }
    
    const article = articles[0];
    console.log('\n--- BÀI VIẾT PENDING CÀO VỀ (TIN THÔ) ---');
    console.log(`ID: ${article.id}`);
    console.log(`Title: ${article.title}`);
    console.log(`URL (Chưa decode): ${article.url}`);
    console.log(`Summary thô: ${article.summary}`);
    
    // 4. Gọi API extract để cào chi tiết bài viết (giải mã URL và cào HTML)
    console.log('\nCalling extract API for this article...');
    const extractRes = await fetch('http://localhost:3000/api/tech-intel/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'extract', articleId: article.id })
    });
    
    if (!extractRes.ok) {
      throw new Error(`Extract API failed: ${extractRes.status} ${await extractRes.text()}`);
    }
    
    const updatedArticle = await extractRes.json();
    console.log('\n--- BÀI VIẾT SAU KHI EXTRACT (THÀNH CÔNG) ---');
    console.log(`ID: ${updatedArticle.id}`);
    console.log(`Title: ${updatedArticle.title}`);
    console.log(`URL mới (Đã decode gốc): ${updatedArticle.url}`);
    console.log(`Thumbnail URL mới: ${updatedArticle.thumbnail_url || updatedArticle.thumbnailUrl}`);
    console.log(`Summary mới (Đã thay thế): ${updatedArticle.summary}`);
    console.log(`Content mới length: ${updatedArticle.content ? updatedArticle.content.length : 0}`);
    
    if (updatedArticle.content) {
      console.log('\nSample Content (300 chars):');
      console.log(updatedArticle.content.substring(0, 300) + '...');
    }
    
  } catch (err) {
    console.error('Error in main flow:', err);
  } finally {
    process.exit(0);
  }
}

main();
