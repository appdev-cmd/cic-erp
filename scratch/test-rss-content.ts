/**
 * Test: Xem Google News RSS <description> chứa gì
 */
async function main() {
  const rssUrl = 'https://news.google.com/rss/search?q=construction+technology+BIM&hl=en&gl=US&ceid=US:en';
  const res = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const xml = await res.text();

  // Extract first 3 items
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  let i = 0;
  while ((match = itemRegex.exec(xml)) !== null && i < 3) {
    const item = match[1];
    
    // Extract fields
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || 'N/A';
    const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || 'N/A';
    const desc = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || 'N/A';
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || 'N/A';
    const source = item.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/);
    
    console.log(`\n=== Article ${i + 1} ===`);
    console.log(`Title: ${title}`);
    console.log(`Link: ${link.substring(0, 80)}...`);
    console.log(`PubDate: ${pubDate}`);
    console.log(`Source tag: ${source ? `${source[2]} (${source[1]})` : 'N/A'}`);
    console.log(`Description (raw): ${desc.substring(0, 500)}`);
    
    // Clean description
    const cleanDesc = desc.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`Description (clean): ${cleanDesc.substring(0, 300)}`);
    
    i++;
  }
}

main().catch(console.error);
