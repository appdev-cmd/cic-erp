/**
 * Shared scraping utilities for tech-intel crawlers.
 *
 * Imported by Vercel serverless functions (crawl.ts, deep-crawl.ts) and CLI scripts.
 * Uses linkedom + @mozilla/readability for robust article extraction.
 */

import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

// ─── Constants ────────────────────────────────────────

/** Maximum character length for extracted article content */
export const MAX_CONTENT_LENGTH = 15000;

/** Minimum word count to consider a page as an article */
export const MIN_ARTICLE_WORDS = 150;

/** HTTP request timeout in milliseconds */
export const SCRAPE_TIMEOUT = 15000;

/** Browser-like User-Agent for fetching pages */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ─── Types / Interfaces ──────────────────────────────

export interface ScrapedContent {
  /** Readability-cleaned HTML content */
  content: string;
  /** Plain text content (no HTML tags) */
  textContent: string;
  /** Article title extracted by Readability */
  title: string;
  /** Short excerpt / description */
  excerpt: string;
  /** Site name (e.g. "TechCrunch") or null */
  siteName: string | null;
}

export interface ArticleMetadata {
  /** og:image or twitter:image URL */
  thumbnailUrl?: string;
  /** Open Graph title */
  ogTitle?: string;
  /** Open Graph description */
  ogDescription?: string;
  /** Canonical URL from <link rel="canonical"> */
  canonicalUrl?: string;
}

// ─── URL patterns that indicate non-article pages ────

const NON_ARTICLE_PATTERNS: RegExp[] = [
  /\/tag\//i,
  /\/category\//i,
  /\/author\//i,
  /\/page\/\d+/i,
  /\/search/i,
  /\/login/i,
  /\/signup/i,
  /\/sign-up/i,
  /\/register/i,
  /\/contact/i,
  /\/about/i,
  /\/privacy/i,
  /\/terms/i,
  /\/career/i,
  /\/careers/i,
  /\/job/i,
  /\/jobs/i,
  /\/pricing/i,
  /\/demo/i,
  /\/feed\/?$/i,
  /\/rss\/?$/i,
  /\/sitemap/i,
  /\.pdf$/i,
  /\.zip$/i,
  /\.exe$/i,
  /\.dmg$/i,
  /#/,
  /[?&]utm_/i,
];

// ─── 1. scrapeWithReadability ─────────────────────────

/**
 * Fetch a URL and extract article content using linkedom + Readability.
 *
 * @param url - The page URL to scrape
 * @returns Parsed article content, or null on any failure
 */
export async function scrapeWithReadability(
  url: string,
): Promise<ScrapedContent | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT),
    });

    if (!response.ok) {
      console.warn(
        `[scrapeWithReadability] HTTP ${response.status} for ${url}`,
      );
      return null;
    }

    const html = await response.text();

    // Parse HTML into a DOM using linkedom
    const { document } = parseHTML(html);

    // Run Readability on the DOM
    const reader = new Readability(document as any);
    const article = reader.parse();

    if (!article || !article.textContent) {
      console.warn(`[scrapeWithReadability] Readability returned no content for ${url}`);
      return null;
    }

    return {
      content: (article.content || '').substring(0, MAX_CONTENT_LENGTH),
      textContent: (article.textContent || '').substring(0, MAX_CONTENT_LENGTH),
      title: article.title || '',
      excerpt: article.excerpt || '',
      siteName: article.siteName || null,
    };
  } catch (error: any) {
    console.warn(
      `[scrapeWithReadability] Error for ${url}:`,
      error.message || error,
    );
    return null;
  }
}

// ─── 2. extractArticleMetadata ────────────────────────

/**
 * Extract Open Graph, Twitter Card, and canonical metadata from raw HTML.
 *
 * Uses regex instead of DOM parsing for speed — suitable for quick metadata
 * extraction without needing a full linkedom parse.
 *
 * @param html - Raw HTML string
 * @returns Extracted metadata fields
 */
export function extractArticleMetadata(html: string): ArticleMetadata {
  const metadata: ArticleMetadata = {};

  // ── Thumbnail: og:image → twitter:image ──
  const ogImage =
    html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    );
  if (ogImage) {
    metadata.thumbnailUrl = ogImage[1];
  } else {
    const twitterImage =
      html.match(
        /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
      );
    if (twitterImage) {
      metadata.thumbnailUrl = twitterImage[1];
    }
  }

  // ── og:title ──
  const ogTitle =
    html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i,
    );
  if (ogTitle) {
    metadata.ogTitle = ogTitle[1];
  }

  // ── og:description ──
  const ogDesc =
    html.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i,
    );
  if (ogDesc) {
    metadata.ogDescription = ogDesc[1];
  }

  // ── Canonical URL ──
  const canonical = html.match(
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
  ) ||
  html.match(
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i,
  );
  if (canonical) {
    metadata.canonicalUrl = canonical[1];
  }

  return metadata;
}

// ─── 3. isArticleUrl ──────────────────────────────────

/**
 * Determine if a URL is likely an article page (ported from crawl4ai_deep.py).
 *
 * Checks:
 * - Must be same domain or subdomain of baseDomain
 * - Must not match known non-article URL patterns
 * - Path must have some depth (not just "/")
 *
 * @param url - Absolute URL to check
 * @param baseDomain - The base domain (e.g. "techcrunch.com")
 * @returns true if the URL is likely an article
 */
export function isArticleUrl(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be HTTP(S)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    // Must be same domain or subdomain
    const hostname = parsed.hostname.toLowerCase();
    const base = baseDomain.toLowerCase();
    if (hostname !== base && !hostname.endsWith('.' + base)) {
      return false;
    }

    // Path must have depth (not just "/" or "")
    const path = parsed.pathname;
    if (!path || path === '/') {
      return false;
    }

    // Check against non-article patterns (applied to full URL)
    const fullUrl = parsed.href;
    for (const pattern of NON_ARTICLE_PATTERNS) {
      if (pattern.test(fullUrl)) {
        return false;
      }
    }

    return true;
  } catch {
    // Malformed URL
    return false;
  }
}

// ─── 4. discoverLinks ─────────────────────────────────

/**
 * Extract, resolve, and filter article links from raw HTML.
 *
 * Parses all <a href="..."> links, resolves relative URLs against baseUrl,
 * then keeps only same-domain links that pass isArticleUrl checks.
 *
 * @param html - Raw HTML string
 * @param baseUrl - The page URL (used for resolving relative hrefs)
 * @param baseDomain - The base domain for same-origin filtering
 * @returns Deduplicated array of absolute article URLs
 */
export function discoverLinks(
  html: string,
  baseUrl: string,
  baseDomain: string,
): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  // Match all <a ...href="..."...> patterns
  const hrefRegex = /<a\s[^>]*href=["']([^"'#][^"']*)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    if (!rawHref || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
      continue;
    }

    try {
      // Resolve relative URLs against baseUrl
      const resolved = new URL(rawHref, baseUrl);

      // Strip fragment and trailing tracking params for dedup
      resolved.hash = '';
      const absoluteUrl = resolved.href;

      if (seen.has(absoluteUrl)) continue;
      seen.add(absoluteUrl);

      if (isArticleUrl(absoluteUrl, baseDomain)) {
        results.push(absoluteUrl);
      }
    } catch {
      // Skip malformed URLs
    }
  }

  return results;
}

// ─── 5. countWords ────────────────────────────────────

/**
 * Count the number of words in a text string.
 *
 * @param text - Plain text string
 * @returns Word count
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.match(/\b\w+\b/g);
  return matches ? matches.length : 0;
}
