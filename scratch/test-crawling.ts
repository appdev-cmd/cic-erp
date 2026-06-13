import '../setup-env.ts';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Thiếu cấu hình Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testCrawl() {
  console.log('Triggering API crawl...');
  
  // Call crawl API local
  // Vì port Vite / Next serverless api chạy local, ta có thể trigger crawl trực tiếp bằng cách gọi logic 
  // của handler hoặc gọi curl tới local dev server.
  // Tuy nhiên, do crawl.ts chạy qua Vercel serverless local,
  // chúng ta có thể gọi HTTP POST lên http://localhost:3000/api/tech-intel/crawl
  // Nhưng hãy kiểm tra xem local server đang chạy ở port nào.
  // Có thể dùng fetch gửi request tới http://localhost:3000/api/tech-intel/crawl hoặc http://localhost:5173/api/tech-intel/crawl
  
  try {
    const res = await fetch('http://localhost:3000/api/tech-intel/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (res.ok) {
      const result = await res.json();
      console.log('Crawl API success:', result);
      
      // Query database to check if articles are saved with original decoded URLs
      const { data: articles, error } = await supabase
        .from('tech_articles')
        .select('id, title, url, summary, status')
        .limit(5);
        
      if (error) throw error;
      
      console.log('Sample crawled articles from DB:');
      articles.forEach((a, i) => {
        console.log(`[Article ${i+1}]`);
        console.log(`- Title: ${a.title}`);
        console.log(`- URL: ${a.url}`);
        console.log(`- Summary: ${a.summary}`);
        console.log(`- Status: ${a.status}`);
      });
      
    } else {
      console.error('Crawl API failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Error in testCrawl:', err);
  } finally {
    process.exit(0);
  }
}

testCrawl();
