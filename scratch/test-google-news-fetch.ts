/**
 * Test script: So sánh cách Node.js fetch() xử lý Google News URL
 * Chạy: npx tsx scratch/test-google-news-fetch.ts
 */

// Lấy 1 Google News RSS feed để test
async function main() {
  console.log('=== TEST GOOGLE NEWS URL FETCH ===\n');

  // Step 1: Parse Google News RSS feed to get a real URL
  const rssUrl = 'https://news.google.com/rss/search?q=construction+technology+BIM&hl=en&gl=US&ceid=US:en';
  console.log('1. Fetching Google News RSS feed...');
  
  const rssRes = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  });
  
  const rssXml = await rssRes.text();
  
  // Extract first 3 item links
  const linkMatches = [...rssXml.matchAll(/<link>(https:\/\/news\.google\.com\/rss\/articles\/[^<]+)<\/link>/g)];
  console.log(`   Found ${linkMatches.length} article links in RSS\n`);
  
  if (linkMatches.length === 0) {
    console.log('No links found. RSS response preview:');
    console.log(rssXml.substring(0, 500));
    return;
  }

  // Step 2: Test fetching each URL directly (like scanner does)
  for (let i = 0; i < Math.min(3, linkMatches.length); i++) {
    const googleNewsUrl = linkMatches[i][1];
    console.log(`\n--- Article ${i + 1} ---`);
    console.log(`Google News URL: ${googleNewsUrl.substring(0, 80)}...`);

    try {
      // Method A: Fetch directly with redirect follow (like Python requests.get)
      console.log('\nMethod A: Direct fetch with redirect:follow...');
      const resA = await fetch(googleNewsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      
      console.log(`   Status: ${resA.status}`);
      console.log(`   Final URL: ${resA.url}`);
      console.log(`   Redirected: ${resA.redirected}`);
      
      const htmlA = await resA.text();
      console.log(`   HTML length: ${htmlA.length}`);
      
      // Check if we got the actual article or Google News page
      const isGooglePage = resA.url.includes('news.google.com') || resA.url.includes('consent.google');
      console.log(`   Is still Google page: ${isGooglePage}`);
      
      if (!isGooglePage) {
        // Extract paragraphs
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let match;
        const paragraphs: string[] = [];
        let cleanHtml = htmlA
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        while ((match = pRegex.exec(cleanHtml)) !== null) {
          const text = match[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text.length > 30) paragraphs.push(text);
        }
        console.log(`   Extracted ${paragraphs.length} paragraphs`);
        if (paragraphs.length > 0) {
          console.log(`   First paragraph preview: ${paragraphs[0].substring(0, 150)}...`);
        }
      } else {
        // Check what Google returned
        const hasConsent = htmlA.includes('consent') || htmlA.includes('Before you continue');
        const hasJsRedirect = htmlA.includes('window.location') || htmlA.includes('location.href');
        const hasMetaRefresh = htmlA.includes('http-equiv="refresh"') || htmlA.includes('http-equiv=\\"refresh\\"');
        console.log(`   Has consent page: ${hasConsent}`);
        console.log(`   Has JS redirect: ${hasJsRedirect}`);
        console.log(`   Has meta refresh: ${hasMetaRefresh}`);
        
        // Try to find actual URL in HTML
        const auMatch = htmlA.match(/data-n-au=["']([^"']+)["']/);
        const ogUrlMatch = htmlA.match(/<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
        console.log(`   data-n-au found: ${auMatch ? auMatch[1].substring(0, 80) : 'NO'}`);
        console.log(`   og:url found: ${ogUrlMatch ? ogUrlMatch[1].substring(0, 80) : 'NO'}`);
        
        // Show HTML snippet for debugging
        console.log(`\n   HTML preview (first 500 chars):`);
        console.log(`   ${htmlA.substring(0, 500)}`);
      }

      // Method B: Fetch with redirect:manual to see raw redirect
      console.log('\nMethod B: Fetch with redirect:manual...');
      const resB = await fetch(googleNewsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
      console.log(`   Status: ${resB.status}`);
      console.log(`   Location header: ${resB.headers.get('location') || 'NONE'}`);

    } catch (err: any) {
      console.log(`   Error: ${err.message}`);
    }
  }
}

main().catch(console.error);
