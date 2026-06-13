import '../setup-env.ts';

async function decodeGoogleNewsBatchExecute(googleNewsUrl: string): Promise<string | null> {
  try {
    const urlObj = new URL(googleNewsUrl);
    const pathParts = urlObj.pathname.split('/');
    const base64Str = pathParts[pathParts.length - 1];
    if (!base64Str || base64Str.length < 10) return null;

    // Bước 1: Fetch HTML để lấy signature và timestamp
    const articlesUrl = `https://news.google.com/articles/${base64Str}`;
    const res = await fetch(articlesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      }
    });
    if (!res.ok) throw new Error(`Fetch articles URL failed: ${res.status}`);
    const html = await res.text();

    // Tìm thẻ c-wiz > div có chứa data-n-a-sg và data-n-a-ts
    // Regex tìm data-n-a-sg="..."
    const sgMatch = html.match(/data-n-a-sg=["']([^"']+)["']/);
    const tsMatch = html.match(/data-n-a-ts=["']([^"']+)["']/);
    
    if (!sgMatch || !tsMatch) {
      console.warn('Cannot find signature or timestamp in HTML.');
      return null;
    }
    
    const signature = sgMatch[1];
    const timestamp = tsMatch[1];
    console.log('Signature:', signature);
    console.log('Timestamp:', timestamp);

    // Bước 2: Gọi POST lên batchexecute
    const batchUrl = 'https://news.google.com/_/DotsSplashUi/data/batchexecute';
    
    // Payload Fbv4je
    const reqData = [
      "Fbv4je", 
      `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${base64Str}",${timestamp},"${signature}"]`
    ];
    
    const fReq = JSON.stringify([[reqData]]);
    const bodyParams = new URLSearchParams();
    bodyParams.append('f.req', fReq);

    const postRes = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      body: bodyParams.toString()
    });

    if (!postRes.ok) throw new Error(`BatchExecute POST failed: ${postRes.status}`);
    const resText = await postRes.text();
    
    // Parse response
    // Response có dạng: \n\n[ [ [ "w7t28e", "[\"garturlres\",...]" ] ] ]
    const lines = resText.split('\n');
    for (const line of lines) {
      if (line.includes('garturlres')) {
        // Tìm mảng JSON
        const match = line.match(/\["w7t28e",\s*"([\s\S]*?)"\s*\]/);
        if (match) {
          // Unescape JSON string
          const escapedStr = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          const data = JSON.parse(escapedStr);
          // data có dạng: ["garturlres", [ [ "X", "X", ... ], "URL_GỐC", ... ] ]
          if (data && data[1] && data[1][1]) {
            return data[1][1];
          }
        }
        
        // Cách parse 2: Parse thủ công bằng regex
        const urlMatch = line.match(/https?:\/\/[^\s"',]+/g);
        if (urlMatch) {
          // Lọc ra các URL phi Google
          const cleanUrls = urlMatch.filter(u => !u.includes('google') && !u.includes('gstatic'));
          if (cleanUrls.length > 0) {
            return cleanUrls[0];
          }
        }
      }
    }

  } catch (e) {
    console.error('Error in decodeGoogleNewsBatchExecute:', e);
  }
  return null;
}

async function main() {
  const url = 'https://news.google.com/rss/articles/CBMibEFVX3lxTE13a1dhTFZuRWd5ZDlvRkVJUGJING1CMEpUYzBMeUNxZ2NLQ01JM2Z3WTd5R2FBNGd6SjJ1b3BlRXVtR29iYmhSNXMtSGNwdE9OTE9XZkkxMHBtaHprb3ZtTUgxYmpGV0hTWWFLXw?oc=5';
  console.log('Decoding URL:', url);
  const result = await decodeGoogleNewsBatchExecute(url);
  console.log('Result:', result);
}

main();
