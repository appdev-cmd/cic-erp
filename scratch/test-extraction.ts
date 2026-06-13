import '../setup-env.ts';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Thiếu cấu hình Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testExtraction() {
  try {
    // 1. Lấy ra một bài viết pending
    const { data: articles, error: fetchErr } = await supabase
      .from('tech_articles')
      .select('id, title, url, content, thumbnail_url, summary')
      .eq('status', 'pending')
      .limit(1);
      
    if (fetchErr) throw fetchErr;
    if (!articles || articles.length === 0) {
      console.log('Không tìm thấy bài viết pending nào. Hãy chạy crawl trước.');
      process.exit(0);
    }
    
    const article = articles[0];
    console.log('--- BÀI VIẾT TRƯỚC KHI EXTRACT ---');
    console.log(`ID: ${article.id}`);
    console.log(`Title: ${article.title}`);
    console.log(`URL: ${article.url}`);
    console.log(`Thumbnail URL hiện tại: ${article.thumbnail_url}`);
    console.log(`Summary hiện tại: ${article.summary}`);
    console.log(`Content hiện tại length: ${article.content ? article.content.length : 0}`);
    
    // 2. Gọi API extract
    console.log('\nCalling extract API...');
    const res = await fetch('http://localhost:3000/api/tech-intel/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'extract', articleId: article.id })
    });
    
    if (res.ok) {
      const updatedArticle = await res.json();
      console.log('\n--- BÀI VIẾT SAU KHI EXTRACT ---');
      console.log(`ID: ${updatedArticle.id}`);
      console.log(`Title: ${updatedArticle.title}`);
      console.log(`URL: ${updatedArticle.url}`);
      console.log(`Thumbnail URL mới: ${updatedArticle.thumbnail_url || updatedArticle.thumbnailUrl}`);
      console.log(`Summary mới: ${updatedArticle.summary}`);
      console.log(`Content mới length: ${updatedArticle.content ? updatedArticle.content.length : 0}`);
      
      if (updatedArticle.content) {
        console.log('\nSample Content (500 chars):');
        console.log(updatedArticle.content.substring(0, 500) + '...');
      }
    } else {
      console.error('Extract API failed:', res.status, await res.text());
    }
    
  } catch (err) {
    console.error('Error in testExtraction:', err);
  } finally {
    process.exit(0);
  }
}

testExtraction();
