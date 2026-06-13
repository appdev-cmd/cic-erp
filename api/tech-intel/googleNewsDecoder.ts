/**
 * Google News URL Decoder
 *
 * URL Google News RSS (news.google.com/rss/articles/CBMi...) là một chuỗi
 * redirect được mã hoá, KHÔNG phải URL bài gốc. Module này giải mã về URL thật
 * để có thể: (1) mở đúng bài gốc, (2) cào nội dung + thumbnail, (3) dedupe chuẩn.
 *
 * Chiến lược 2 lớp:
 *   1. batchExecute  — gọi API nội bộ của Google News (chính xác nhất cho mọi format mới)
 *   2. base64 decode — bóc URL nhúng trong chuỗi base64 (nhanh, không cần network, cho format cũ)
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Làm sạch URL bị escape trong response JSON của Google (\\u003d → =, trailing \\, …) */
function cleanDecodedUrl(raw: string): string {
  let url = raw
    // \/  hoặc  \\/  → /
    .replace(/\\+\//g, '/')
    // \uXXXX hoặc \\uXXXX (escape unicode bị nhân đôi backslash) → ký tự thật
    .replace(/\\+u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\+"/g, '"');
  // Cắt phần rác phía sau (backslash, dấu nháy, khoảng trắng, dấu < > còn sót)
  url = url.replace(/[\\"'\s<>].*$/s, '').trim();
  return url;
}

/** Lấy chuỗi base64 (segment cuối của path) từ URL Google News */
function extractBase64Segment(googleNewsUrl: string): string | null {
  try {
    const u = new URL(googleNewsUrl);
    if (!u.hostname.includes('news.google.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const seg = parts[parts.length - 1];
    if (!seg || seg.length < 16) return null;
    return seg;
  } catch {
    return null;
  }
}

/** Lớp 1: giải mã qua API batchexecute của Google News (đáng tin nhất). */
async function decodeViaBatchExecute(base64Str: string, timeoutMs: number): Promise<string | null> {
  try {
    // B1: lấy signature + timestamp từ trang articles
    const articlesUrl = `https://news.google.com/articles/${base64Str}`;
    const res = await fetch(articlesUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const sg = html.match(/data-n-a-sg=["']([^"']+)["']/)?.[1];
    const ts = html.match(/data-n-a-ts=["']([^"']+)["']/)?.[1];
    if (!sg || !ts) return null;

    // B2: gọi batchexecute với payload Fbv4je
    const reqData = [
      'Fbv4je',
      `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${base64Str}",${ts},"${sg}"]`,
    ];
    const body = new URLSearchParams();
    body.append('f.req', JSON.stringify([[reqData]]));

    const postRes = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': UA,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!postRes.ok) return null;
    const text = await postRes.text();

    // Response: các dòng JSON; tìm dòng chứa "garturlres"
    for (const line of text.split('\n')) {
      if (!line.includes('garturlres')) continue;

      // Cách 1: parse JSON chuẩn
      const m = line.match(/\["(?:wrb\.fr|[a-zA-Z0-9]+)",\s*"((?:\\.|[^"\\])*garturlres(?:\\.|[^"\\])*)"/);
      if (m) {
        try {
          const inner = JSON.parse(`"${m[1]}"`); // unescape 1 lớp
          const arr = JSON.parse(inner);
          const url = arr?.[1]?.[1];
          if (typeof url === 'string' && url.startsWith('http')) return cleanDecodedUrl(url);
        } catch {
          /* rơi xuống cách 2 */
        }
      }

      // Cách 2: bóc URL phi-Google trực tiếp trong dòng
      const urls = line.match(/https?:\/\/[^\s"',\]]+/g);
      const real = urls?.map(cleanDecodedUrl).find(
        u => u && !u.includes('google.com') && !u.includes('gstatic.com') && !u.includes('googleusercontent'),
      );
      if (real) return real;
    }
    return null;
  } catch {
    return null;
  }
}

/** Lớp 2: bóc URL nhúng trong chuỗi base64 (format cũ CBMi..., không cần network). */
function decodeViaBase64(base64Str: string): string | null {
  try {
    let b64 = base64Str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const decoded = Buffer.from(b64, 'base64').toString('binary');

    const httpsIdx = decoded.indexOf('https://');
    const httpIdx = decoded.indexOf('http://');
    const start = httpsIdx !== -1 ? httpsIdx : httpIdx;
    if (start === -1) return null;

    const match = decoded.substring(start).match(/^(https?:\/\/[^\s"'><\]\[{}|\\^`\x00-\x1f\x7f-\xff]+)/);
    if (!match) return null;
    const url = cleanDecodedUrl(match[1]);
    // Một số chuỗi base64 chỉ chứa metadata, không phải URL thật → loại bỏ giá trị quá ngắn
    return url.length > 15 && !url.includes('news.google.com') ? url : null;
  } catch {
    return null;
  }
}

/**
 * Giải mã nhanh (ĐỒNG BỘ, không network) — chỉ thử bóc URL trong chuỗi base64.
 * Trả về URL gốc nếu thành công, ngược lại null. Dùng trong vòng lặp crawl để
 * không làm chậm request.
 */
export function decodeGoogleNewsUrlSync(googleNewsUrl: string): string | null {
  const base64Str = extractBase64Segment(googleNewsUrl);
  if (!base64Str) return null;
  return decodeViaBase64(base64Str);
}

/**
 * Giải mã 1 URL Google News về URL bài gốc (đầy đủ: base64 → batchexecute).
 * Trả về URL gốc, hoặc URL đầu vào nếu không giải mã được (không bao giờ ném lỗi).
 */
export async function decodeGoogleNewsUrl(googleNewsUrl: string, timeoutMs = 8000): Promise<string> {
  const base64Str = extractBase64Segment(googleNewsUrl);
  if (!base64Str) return googleNewsUrl;

  // Thử base64 trước (nhanh, không tốn network) — đa số format cũ giải được ngay
  const fast = decodeViaBase64(base64Str);
  if (fast) return fast;

  // Format mới → cần batchexecute
  const viaBatch = await decodeViaBatchExecute(base64Str, timeoutMs);
  return viaBatch || googleNewsUrl;
}

/** Tiện ích: kiểm tra 1 URL có phải Google News redirect không. */
export function isGoogleNewsUrl(url: string): boolean {
  return url.includes('news.google.com');
}
