import '../setup-env.ts';
import * as fs from 'fs';

async function main() {
  const url = 'https://news.google.com/rss/articles/CBMibEFVX3lxTE13a1dhTFZuRWd5ZDlvRkVJUGJING1CMEpUYzBMeUNxZ2NLQ01JM2Z3WTd5R2FBNGd6SjJ1b3BlRXVtR29iYmhSNXMtSGNwdE9OTE9XZkkxMHBtaHprb3ZtTUgxYmpGV0hTWWFLXw?oc=5';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    
    // Tìm tất cả các link http/https trong html
    const urls = html.match(/https?:\/\/[^\s"'><\]\[{}|\\^`]+/g) || [];
    console.log('Total URLs found:', urls.length);
    
    // Lọc các URL không thuộc domain google
    const nonGoogleUrls = Array.from(new Set(urls.filter(u => !u.includes('google') && !u.includes('gstatic') && !u.includes('schema.org') && !u.includes('w3.org'))));
    console.log('Non-Google URLs found:', nonGoogleUrls.length);
    console.log('Non-Google URLs list:');
    nonGoogleUrls.forEach(u => console.log('-', u));
    
  } catch (e) {
    console.error(e);
  }
}

main();
