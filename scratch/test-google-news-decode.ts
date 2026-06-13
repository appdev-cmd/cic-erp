import { Buffer } from 'buffer';

function decodeGoogleNewsUrl(googleNewsUrl: string): string {
  try {
    const urlObj = new URL(googleNewsUrl);
    if (!urlObj.hostname.includes('news.google.com')) {
      return googleNewsUrl;
    }
    const pathParts = urlObj.pathname.split('/');
    const encodedStr = pathParts[pathParts.length - 1];
    if (!encodedStr || encodedStr.length < 10) return googleNewsUrl;

    // Decode base64
    let base64 = encodedStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decoded = Buffer.from(base64, 'base64').toString('binary');
    
    const httpIdx = decoded.indexOf('http://');
    const httpsIdx = decoded.indexOf('https://');
    const startIdx = httpsIdx !== -1 ? httpsIdx : httpIdx;
    
    if (startIdx !== -1) {
      const rawUrlPart = decoded.substring(startIdx);
      const match = rawUrlPart.match(/^(https?:\/\/[^\s"'><\]\[{}|\\^`\x00-\x1f\x7f-\xff]+)/);
      if (match) {
        return match[1];
      }
    }
  } catch (e) {
    console.error('Error decoding Google News URL:', e);
  }
  return googleNewsUrl;
}

// Test case
const testUrl = 'https://news.google.com/rss/articles/CBMiM2h0dHBzOi8vd3d3LnRoZXZlcmdlLmNvbS8yMDI2LzA2LzEzL25ldy1wbGF5c3RhdGlvbi12ctIBAA?oc=5';
console.log('Original:', testUrl);
console.log('Decoded:', decodeGoogleNewsUrl(testUrl));
