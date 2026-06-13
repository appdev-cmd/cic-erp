import '../setup-env.ts';

async function main() {
  const url = 'https://news.google.com/rss/articles/CBMibEFVX3lxTE13a1dhTFZuRWd5ZDlvRkVJUGJING1CMEpUYzBMeUNxZ2NLQ01JM2Z3WTd5R2FBNGd6SjJ1b3BlRXVtR29iYmhSNXMtSGNwdE9OTE9XZkkxMHBtaHprb3ZtTUgxYmpGV0hTWWFLXw?oc=5';
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    console.log('HTML Length:', html.length);
    console.log('--- HTML FIRST 2000 CHARACTERS ---');
    console.log(html.substring(0, 2000));
    console.log('--- HTML LAST 1000 CHARACTERS ---');
    console.log(html.substring(html.length - 1000));
    
    // Test match regex
    const metaMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*url=([^"'>]+)["']/i) || 
                      html.match(/<meta[^>]*content=["'][^"']*url=([^"'>]+)["']/i);
    console.log('\nRegex Meta Match URL:', metaMatch?.[1]);
    
    const aMatch = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>click here/i) || 
                   html.match(/<a[^>]*href=["']([^"']+)["']/i);
    console.log('Regex A Match URL:', aMatch?.[1]);
  } catch (e) {
    console.error(e);
  }
}

main();
