import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { decodeGoogleNewsUrl, decodeGoogleNewsUrlSync, isGoogleNewsUrl } from './googleNewsDecoder';
import { scrapeWithReadability, extractArticleMetadata, MAX_CONTENT_LENGTH } from './scraper';

/**
 * Vercel Serverless Function: /api/tech-intel/crawl
 *
 * Crawl RSS feeds from tech_sources and upsert new articles.
 * Supports: standard RSS, Atom, and Google News RSS.
 *
 * Usage:
 *   POST /api/tech-intel/crawl
 *   Body: { sourceId?: string } — crawl specific source or all active sources
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  // GET được dùng bởi Vercel Cron (crawl toàn bộ nguồn active); POST dùng cho UI.
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { sourceId, action, articleId } = req.method === 'POST'
    ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}))
    : {} as any;

  // ─── ACTION: EXTRACT CONTENT FROM URL ─────────────────
  if (action === 'extract') {
    if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
    try {
      const { data: article, error: fetchErr } = await supabase
        .from('tech_articles')
        .select('id, url, content, title, summary')
        .eq('id', articleId)
        .single();

      if (fetchErr || !article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Nếu đã có content tương đối đầy đủ thì trả về luôn
      if (article.content && article.content.length > 200) {
        return res.status(200).json(article);
      }

      // Sử dụng hàm scrapeArticlePage tái sử dụng
      const scraped = await scrapeArticlePage(article.url, article.title, article.summary);

      if (scraped && Object.keys(scraped).length > 0) {
        const { data: updated, error: updateErr } = await supabase
          .from('tech_articles')
          .update(scraped)
          .eq('id', articleId)
          .select('*')
          .single();
        
        if (!updateErr && updated) {
          return res.status(200).json(updated);
        }
      }

      return res.status(200).json(article);

    } catch (err: any) {
      console.error(`[crawl/extract] Error for ${articleId}:`, err);
      return res.status(500).json({ error: err.message || 'Scrape Error' });
    }
  }

  // ─── ACTION: TRIGGER DEEP CRAWL (via deep-crawl API) ────────
  if (action === 'trigger-deep-crawl') {
    try {
      // Call deep-crawl API directly (same Vercel deployment)
      const baseUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
      const deepCrawlRes = await fetch(`${baseUrl}/api/tech-intel/deep-crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });

      const result = await deepCrawlRes.json();
      return res.status(deepCrawlRes.status).json(result);
    } catch (err: any) {
      console.error('[crawl/trigger-deep-crawl] Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to trigger deep crawl' });
    }
  }

  try {
    // Fetch sources to crawl
    let query = supabase.from('tech_sources').select('*').eq('is_active', true);
    if (sourceId) query = query.eq('id', sourceId);

    const { data: sources, error: srcErr } = await query;
    if (srcErr) throw srcErr;
    if (!sources || sources.length === 0) {
      return res.status(200).json({ message: 'No active sources found', crawled: 0 });
    }

    let totalNew = 0;
    const results: { source: string; newArticles: number; error?: string }[] = [];

    for (const source of sources) {
      try {
        const articles = await fetchRSS(source.url);
        if (articles.length === 0) {
          results.push({ source: source.name, newArticles: 0 });
          continue;
        }

        // Filter out spam/junk before inserting to save database space
        const cleanArticles = articles.filter(a => !isSpamOrJunk(a.title, a.url));
        if (cleanArticles.length === 0) {
          results.push({ source: source.name, newArticles: 0 });
          continue;
        }

        // Upsert articles (deduplicate by URL)
        const rows = cleanArticles.map(a => {
          // Loại bỏ summary nếu trùng hoặc gần giống title
          let summary = a.summary || null;
          if (summary) {
            const normTitle = a.title.replace(/\s+/g, '').toLowerCase();
            const normSummary = summary.replace(/\s+/g, '').toLowerCase();
            if (normSummary === normTitle || normSummary.startsWith(normTitle) || normTitle.startsWith(normSummary)) {
              summary = null;
            }
          }
          // Giải mã URL Google News → URL bài gốc.
          // Ưu tiên fast-path base64 (đồng bộ, không network); nếu không được thì
          // giữ URL Google News, để bước scrape/extract giải mã đầy đủ (batchexecute) sau.
          let url = a.url;
          if (isGoogleNewsUrl(url)) {
            url = decodeGoogleNewsUrlSync(url) || url;
          }
          return {
            title: a.title,
            url,
            source_id: source.id,
            summary,
            // content:encoded từ RSS (nếu có) → full content ngay, khỏi cần scrape
            content: a.content || null,
            thumbnail_url: a.thumbnailUrl,
            published_at: a.publishedAt,
            language: source.language || 'en',
            status: 'pending',
          };
        });

        const { data: inserted, error: insertErr } = await supabase
          .from('tech_articles')
          .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
          .select('id, url, title, summary, content');

        if (insertErr) throw insertErr;

        const newCount = inserted?.length || 0;
        totalNew += newCount;
        results.push({ source: source.name, newArticles: newCount });

        // ── Auto-scrape content for new articles còn thiếu content ──
        // Bỏ qua bài đã có content (từ content:encoded) và URL Google News chưa decode.
        if (inserted && inserted.length > 0) {
          const toScrape = inserted
            .filter((a: any) => !a.url.includes('news.google.com') && (!a.content || a.content.length < 200))
            .slice(0, 10);
          
          if (toScrape.length > 0) {
            let scraped = 0;
            for (let i = 0; i < toScrape.length; i += 3) {
              const batch = toScrape.slice(i, i + 3);
              await Promise.allSettled(
                batch.map(async (a: any) => {
                  const data = await scrapeArticlePage(a.url, a.title, a.summary);
                  if (data && Object.keys(data).length > 0) {
                    await supabase.from('tech_articles').update(data).eq('id', a.id);
                    scraped++;
                  }
                })
              );
            }
            console.log(`[crawl] Auto-scraped content: ${scraped}/${toScrape.length} articles from ${source.name}`);
          }

          // Google News articles: AI sẽ phân tích dựa title (không cần content)
          const googleNewsCount = inserted.length - toScrape.length;
          if (googleNewsCount > 0) {
            console.log(`[crawl] Skipped ${googleNewsCount} Google News articles (cannot scrape server-side)`);
          }
        }

        // Update source metadata
        await supabase.from('tech_sources').update({
          last_crawled_at: new Date().toISOString(),
          article_count: (source.article_count || 0) + newCount,
          updated_at: new Date().toISOString(),
        }).eq('id', source.id);

      } catch (crawlErr: any) {
        results.push({ source: source.name, newArticles: 0, error: crawlErr.message });
      }
    }

    return res.status(200).json({
      message: `Crawled ${sources.length} sources, found ${totalNew} new articles`,
      totalNew,
      results,
    });

  } catch (error: any) {
    console.error('[tech-intel/crawl] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// ─── Scrape Article Page (reusable) ───────────────────

/**
 * Scrape full-page content, og:image thumbnail, and fix duplicate summary.
 * Uses @mozilla/readability for much better content extraction than regex.
 * Returns an update payload for tech_articles, or null if nothing useful.
 */
export async function scrapeArticlePage(
  articleUrl: string,
  title: string,
  currentSummary: string | null
): Promise<{ content?: string; thumbnail_url?: string; summary?: string; url?: string } | null> {
  try {
    // Google News URL → giải mã về URL bài gốc trước khi cào (batchexecute).
    // Nếu giải mã không được thì bỏ qua (không thể cào trang redirect của Google).
    let targetUrl = articleUrl;
    if (isGoogleNewsUrl(articleUrl)) {
      const resolved = await decodeGoogleNewsUrl(articleUrl, 8000);
      if (isGoogleNewsUrl(resolved)) {
        console.log(`[scrapeArticlePage] Cannot decode Google News URL, skipping`);
        return null;
      }
      targetUrl = resolved;
    }

    // Use Readability-based scraping for better content extraction
    const scraped = await scrapeWithReadability(targetUrl);

    // Also fetch raw HTML for metadata extraction (og:image, canonical URL)
    let thumbnailUrl: string | null = null;
    let finalUrl = targetUrl;
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const html = await response.text();
        finalUrl = response.url || targetUrl;
        const metadata = extractArticleMetadata(html);
        if (metadata.thumbnailUrl) thumbnailUrl = metadata.thumbnailUrl;
        if (metadata.canonicalUrl) finalUrl = metadata.canonicalUrl;
      }
    } catch {
      // Metadata extraction is best-effort, continue even if it fails
    }

    const result: Record<string, string> = {};

    // Use Readability content if available (much better quality)
    if (scraped && scraped.textContent && scraped.textContent.length > 50) {
      result.content = scraped.textContent.substring(0, MAX_CONTENT_LENGTH);
    }

    if (thumbnailUrl) result.thumbnail_url = thumbnailUrl;

    // Fix summary if it duplicates title
    const isDuplicate = !currentSummary ||
                        currentSummary === title ||
                        currentSummary.toLowerCase().includes(title.toLowerCase()) ||
                        currentSummary.replace(/\s+/g, '').includes(title.replace(/\s+/g, ''));
    if (isDuplicate && scraped?.excerpt) {
      result.summary = scraped.excerpt.substring(0, 300);
    }

    if (finalUrl && finalUrl !== articleUrl) result.url = finalUrl;
    else if (targetUrl !== articleUrl) result.url = targetUrl;

    return Object.keys(result).length > 0 ? result : null;
  } catch (e: any) {
    console.warn(`[scrapeArticlePage] Error for ${articleUrl}:`, e.message || e);
    return null;
  }
}

// ─── RSS Parser ───────────────────────────────────────

interface ParsedArticle {
  title: string;
  url: string;
  sourceUrl?: string; // URL bài gốc (extracted from <source url="..."> in Google News RSS)
  summary?: string;
  content?: string;   // full content từ <content:encoded> nếu feed cung cấp
  thumbnailUrl?: string;
  publishedAt?: string;
}

export async function fetchRSS(feedUrl: string): Promise<ParsedArticle[]> {
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  return parseRSSXML(xml);
}

function parseRSSXML(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];

  // Try RSS 2.0 <item> tags
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const article = extractArticleFromXML(itemXml);
    if (article) articles.push(article);
  }

  // Try Atom <entry> tags if no items found
  if (articles.length === 0) {
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const article = extractArticleFromAtomXML(entryXml);
      if (article) articles.push(article);
    }
  }

  return articles;
}

function extractArticleFromXML(itemXml: string): ParsedArticle | null {
  const title = extractTag(itemXml, 'title');
  const link = extractTag(itemXml, 'link');
  if (!title || !link) return null;

  const description = extractTag(itemXml, 'description');
  const pubDate = extractTag(itemXml, 'pubDate');
  const thumbnail = extractMediaThumbnail(itemXml);

  // Full content nếu feed có <content:encoded> (vd: Autodesk, Dezeen, PBC Today...)
  const contentEncoded = extractTag(itemXml, 'content:encoded');
  const content = contentEncoded ? cleanContent(contentEncoded, 3500) : undefined;

  const isGoogleNews = link.includes('news.google.com');

  // Google News: extract <source url="https://real-site.com">Publisher</source>
  let sourceUrl: string | undefined;
  if (isGoogleNews) {
    const sourceMatch = itemXml.match(/<source[^>]*url=["']([^"']+)["']/i);
    if (sourceMatch) {
      sourceUrl = sourceMatch[1];
    }
  }

  // Google News description chỉ chứa link + tên nguồn → không hữu ích → bỏ qua
  let summary: string | undefined;
  if (description) {
    if (isGoogleNews) {
      // Google News description chỉ là: <a href="...">Title</a> <font>Source</font>
      // → Không có giá trị làm summary, bỏ qua
      summary = undefined;
    } else {
      summary = cleanContent(description, 500);
    }
  }

  return {
    title: decodeHTMLEntities(title),
    url: link.trim(),
    sourceUrl,
    summary,
    content,
    thumbnailUrl: thumbnail,
    publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
  };
}

function extractArticleFromAtomXML(entryXml: string): ParsedArticle | null {
  const title = extractTag(entryXml, 'title');
  const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["']/);
  const link = linkMatch?.[1];
  if (!title || !link) return null;

  const summary = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content');
  const updated = extractTag(entryXml, 'updated') || extractTag(entryXml, 'published');

  return {
    title: decodeHTMLEntities(title),
    url: link.trim(),
    summary: summary ? cleanContent(summary, 500) : undefined,
    publishedAt: updated ? new Date(updated).toISOString() : undefined,
  };
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular tags
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractMediaThumbnail(xml: string): string | undefined {
  // <media:thumbnail url="...">
  const mediaMatch = xml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
  if (mediaMatch) return mediaMatch[1];

  // <enclosure url="..." type="image/...">
  const encMatch = xml.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
  if (encMatch) return encMatch[1];

  // <img src="..."> in description
  const imgMatch = xml.match(/<img[^>]*src=["']([^"']+)["']/i);
  return imgMatch ? imgMatch[1] : undefined;
}

/**
 * Deep-clean HTML content → pure text for AI analysis.
 * Strips script/style blocks, HTML tags, entities, junk URLs, excessive whitespace.
 */
function cleanContent(html: string, maxLength: number = 2000): string {
  let text = html;

  // 1. Remove entire <script>, <style>, <noscript> blocks (including content)
  text = text.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 2. Strip all HTML tags
  text = text.replace(/<[^>]*>/g, ' ');

  // 3. Decode HTML entities
  text = decodeHTMLEntities(text);

  // 4. Remove long URLs that leaked into text
  text = text.replace(/https?:\/\/\S{80,}/g, '');

  // 5. Remove CSS/JS artifacts: { ... } blocks, selectors
  text = text.replace(/\{[^}]{20,}\}/g, ' ');

  // 6. Remove common boilerplate patterns
  text = text.replace(/\b(advertisement|sponsored|cookie\s*policy|privacy\s*policy|terms\s*of\s*(service|use))\b/gi, '');

  // 7. Collapse excessive whitespace → single space, trim
  text = text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // 8. Truncate to maxLength
  if (text.length > maxLength) {
    text = text.substring(0, maxLength).replace(/\s\S*$/, '') + '…';
  }

  return text;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)));
}

export function isSpamOrJunk(title: string, url: string): boolean {
  const lowercaseTitle = title.toLowerCase().trim();
  const lowercaseUrl = url.toLowerCase();

  // Standard junk page patterns in news feeds
  const junkTitles = [
    'contact us', 'privacy policy', 'terms of service', 'terms of use', 
    'cookie policy', 'about us', 'sitemap', 'advertise with us', 
    'newsletter sign-up', 'subscribe', 'log in', 'sign up',
    'editorial policy', 'terms & conditions', 'contact'
  ];

  const junkUrlPaths = [
    '/contact', '/privacy', '/terms', '/about-us', '/sitemap', 
    '/cookie-policy', '/advertise', '/subscribe', '/login', '/signup'
  ];

  // Check if title matches any junk title exactly or starts with it
  if (junkTitles.some(jt => lowercaseTitle === jt || lowercaseTitle.startsWith(jt + ' -') || lowercaseTitle.startsWith(jt + ' |'))) {
    return true;
  }

  // Check if URL contains junk paths
  if (junkUrlPaths.some(jp => lowercaseUrl.includes(jp))) {
    return true;
  }

  // If title is too short (e.g. under 8 characters)
  if (title.trim().length < 8) {
    return true;
  }

  return false;
}
