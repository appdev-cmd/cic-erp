import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  scrapeWithReadability,
  extractArticleMetadata,
  isArticleUrl,
  discoverLinks,
  countWords,
  MAX_CONTENT_LENGTH,
  MIN_ARTICLE_WORDS,
  USER_AGENT,
} from './scraper';

/**
 * Vercel Serverless Function: /api/tech-intel/deep-crawl
 *
 * Weekly BFS deep crawler for discovering new articles from vendor/tech
 * company websites that don't have RSS feeds.
 *
 * Targets: Autodesk, Bentley, Trimble, Hexagon, Procore, etc.
 *
 * Pipeline:
 *   1. Fetch deep_crawl / web sources from Supabase
 *   2. BFS crawl each source URL (configurable depth 1-3)
 *   3. Filter pages: only keep article-like content (>= 150 words)
 *   4. Upsert discovered articles to Supabase
 *   5. Update source metadata
 *
 * Usage:
 *   GET  /api/tech-intel/deep-crawl          — Vercel Cron (all sources)
 *   POST /api/tech-intel/deep-crawl          — UI trigger
 *   POST body: { sourceId?: string }
 */

// ─── Supabase ────────────────────────────────────────────────

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_PAGES = 50;

/** Leave 10s buffer for Vercel's 60s function timeout */
const TIME_BUDGET_MS = 50_000;

// ─── Source config interface ─────────────────────────────────

interface SourceConfig {
  maxDepth?: number;
  maxPages?: number;
  max_depth?: number;  // snake_case variant from Python config
  max_pages?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  include_patterns?: string[];
  exclude_patterns?: string[];
}

interface TechSource {
  id: string;
  name: string;
  url: string;
  type: string;
  language?: string;
  is_active: boolean;
  article_count?: number;
  config?: SourceConfig | null;
}

interface DiscoveredArticle {
  title: string;
  url: string;
  summary: string | null;
  content: string | null;
  thumbnail_url: string | null;
}

interface CrawlResult {
  source: string;
  newArticles: number;
  pagesChecked: number;
  error?: string;
}

// ─── Scraper Utilities (local helpers) ───────────────────────

/**
 * Extract the base domain from a URL (strips www.).
 */
function getBaseDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Fetch a page's HTML with timeout and user-agent.
 */
async function fetchPage(url: string, timeoutMs = 10_000): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

// ─── BFS Deep Crawl ──────────────────────────────────────────

/**
 * BFS deep crawl a single source.
 * Respects time budget and maxPages/maxDepth limits.
 */
async function deepCrawlSource(
  source: TechSource,
  startTime: number,
): Promise<{ articles: DiscoveredArticle[]; pagesChecked: number; stoppedEarly: boolean }> {
  const config = source.config || {};
  const baseDomain = getBaseDomain(source.url);
  const maxDepth = config.maxDepth ?? config.max_depth ?? DEFAULT_MAX_DEPTH;
  const maxPages = config.maxPages ?? config.max_pages ?? DEFAULT_MAX_PAGES;
  const includePatterns = (config.includePatterns ?? config.include_patterns ?? []).map((p: string) => new RegExp(p, 'i'));
  const excludePatterns = (config.excludePatterns ?? config.exclude_patterns ?? []).map((p: string) => new RegExp(p, 'i'));

  const visited = new Set<string>();
  const discovered: DiscoveredArticle[] = [];

  // BFS queue: [url, depth]
  const queue: Array<[string, number]> = [[source.url, 0]];
  let pagesChecked = 0;
  let stoppedEarly = false;

  while (queue.length > 0) {
    // Time budget check
    if (Date.now() - startTime > TIME_BUDGET_MS) {
      stoppedEarly = true;
      console.log(`[deep-crawl] Time budget exhausted for ${source.name} after ${pagesChecked} pages`);
      break;
    }

    // Max pages check
    if (pagesChecked >= maxPages) {
      console.log(`[deep-crawl] Max pages (${maxPages}) reached for ${source.name}`);
      break;
    }

    const [currentUrl, depth] = queue.shift()!;

    // Normalize URL for dedup
    const normalizedUrl = currentUrl.split('#')[0].replace(/\/+$/, '');
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);

    // Fetch page
    const html = await fetchPage(currentUrl);
    if (!html) continue;
    pagesChecked++;

    // Discover new links from this page (only if we haven't exceeded depth)
    if (depth < maxDepth) {
      const links = discoverLinks(html, currentUrl, baseDomain);
      for (const link of links) {
        const normLink = link.split('#')[0].replace(/\/+$/, '');
        if (!visited.has(normLink)) {
          queue.push([link, depth + 1]);
        }
      }
    }

    // Skip the seed page itself (depth 0) for article extraction — it's usually an index page
    if (depth === 0) continue;

    // Apply include/exclude patterns
    if (includePatterns.length > 0 && !includePatterns.some(p => p.test(currentUrl))) {
      continue;
    }
    if (excludePatterns.length > 0 && excludePatterns.some(p => p.test(currentUrl))) {
      continue;
    }

    // Check if URL looks like an article
    if (!isArticleUrl(currentUrl, baseDomain)) {
      continue;
    }

    // Extract article content using Readability (via scraper.ts)
    const scraped = await scrapeWithReadability(currentUrl);
    if (!scraped || !scraped.textContent) continue;

    // Must have enough content to be an article
    if (countWords(scraped.textContent) < MIN_ARTICLE_WORDS) continue;
    if (scraped.title.length < 10) continue;

    // Extract metadata (thumbnail) from raw HTML
    const metadata = extractArticleMetadata(html);

    discovered.push({
      title: scraped.title,
      url: currentUrl,
      summary: scraped.excerpt ? scraped.excerpt.substring(0, 300) : null,
      content: scraped.textContent.substring(0, MAX_CONTENT_LENGTH),
      thumbnail_url: metadata.thumbnailUrl || null,
    });

    console.log(`[deep-crawl]   📄 Found: ${scraped.title.substring(0, 60)}... (${countWords(scraped.textContent)} words)`);
  }

  return { articles: discovered, pagesChecked, stoppedEarly };
}

// ─── Handler ─────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Accept GET (Vercel Cron) and POST (UI trigger)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { sourceId } = req.method === 'POST'
    ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}))
    : ({} as any);

  try {
    // Fetch sources to deep-crawl
    let query = supabase
      .from('tech_sources')
      .select('*')
      .eq('is_active', true);

    if (sourceId) {
      query = query.eq('id', sourceId);
    } else {
      query = query.in('type', ['deep_crawl', 'web']);
    }

    const { data: sources, error: srcErr } = await query;
    if (srcErr) throw srcErr;

    if (!sources || sources.length === 0) {
      return res.status(200).json({
        message: 'No active deep crawl sources found',
        crawled: 0,
      });
    }

    console.log(`[deep-crawl] Starting BFS deep crawl for ${sources.length} source(s)`);

    let totalNew = 0;
    let totalPagesChecked = 0;
    const results: CrawlResult[] = [];
    let stoppedEarly = false;

    for (const source of sources as TechSource[]) {
      // Global time budget check before starting next source
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log(`[deep-crawl] Global time budget exhausted, skipping remaining sources`);
        stoppedEarly = true;
        break;
      }

      try {
        console.log(`[deep-crawl] 🔍 Crawling: ${source.name} (${source.url})`);

        const { articles, pagesChecked, stoppedEarly: sourceStoppedEarly } = await deepCrawlSource(
          source,
          startTime,
        );

        totalPagesChecked += pagesChecked;

        if (sourceStoppedEarly) stoppedEarly = true;

        if (articles.length === 0) {
          results.push({ source: source.name, newArticles: 0, pagesChecked });
          continue;
        }

        // Upsert articles to DB
        const now = new Date().toISOString();
        const rows = articles.map(a => ({
          title: a.title,
          url: a.url,
          source_id: source.id,
          summary: a.summary,
          content: a.content,
          thumbnail_url: a.thumbnail_url,
          published_at: null, // Deep crawl can't reliably extract dates
          language: source.language || 'en',
          status: 'pending',
          updated_at: now,
        }));

        const { data: inserted, error: insertErr } = await supabase
          .from('tech_articles')
          .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
          .select('id');

        if (insertErr) {
          console.error(`[deep-crawl] Upsert error for ${source.name}:`, insertErr);
          results.push({
            source: source.name,
            newArticles: 0,
            pagesChecked,
            error: insertErr.message,
          });
          continue;
        }

        const newCount = inserted?.length || 0;
        totalNew += newCount;

        console.log(`[deep-crawl]   ✅ Upserted ${newCount} articles from ${source.name}`);

        // Update source metadata
        await supabase
          .from('tech_sources')
          .update({
            last_crawled_at: now,
            article_count: (source.article_count || 0) + newCount,
            updated_at: now,
          })
          .eq('id', source.id);

        results.push({ source: source.name, newArticles: newCount, pagesChecked });
      } catch (crawlErr: any) {
        console.error(`[deep-crawl] Error crawling ${source.name}:`, crawlErr);
        results.push({
          source: source.name,
          newArticles: 0,
          pagesChecked: 0,
          error: crawlErr.message,
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return res.status(200).json({
      message: `Deep crawled ${results.length}/${sources.length} sources, found ${totalNew} new articles in ${elapsed}s`,
      totalNew,
      totalPagesChecked,
      stoppedEarly,
      elapsedSeconds: parseFloat(elapsed),
      results,
    });
  } catch (error: any) {
    console.error('[tech-intel/deep-crawl] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
