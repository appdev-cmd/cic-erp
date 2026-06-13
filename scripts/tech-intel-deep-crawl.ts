/**
 * CIC ERP — ConTech Intelligence Hub: Weekly BFS Deep Crawler CLI
 * =================================================================
 *
 * TypeScript replacement for crawl4ai_deep.py.
 * BFS crawls vendor/tech company websites to discover articles beyond RSS feeds.
 * Runs locally — NO time limit (unlike Vercel function), can take as long as needed.
 *
 * Pipeline:
 *   1. Load .env → create Supabase client
 *   2. Fetch deep_crawl/web sources from tech_sources
 *   3. For each source:  BFS from root URL → discover links → scrape article pages
 *   4. Filter: only pages with ≥ 150 words
 *   5. Upsert discovered articles to tech_articles
 *   6. Update source metadata
 *
 * Usage:
 *   npx tsx scripts/tech-intel-deep-crawl.ts                # Deep crawl all sources
 *   npx tsx scripts/tech-intel-deep-crawl.ts --source-id=X  # Specific source
 *   npx tsx scripts/tech-intel-deep-crawl.ts --dry-run       # Discovery only, no DB write
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import {
  scrapeWithReadability,
  extractArticleMetadata,
  discoverLinks,
  isArticleUrl,
  countWords,
  MAX_CONTENT_LENGTH,
  MIN_ARTICLE_WORDS,
  USER_AGENT,
} from '../api/tech-intel/scraper';

// ─── Load Environment Variables ──────────────────────────

function loadEnv(p: string) {
  try { for (const l of fs.readFileSync(p, 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i > 0) { const k = t.slice(0, i).trim(); if (!process.env[k]) process.env[k] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, ''); } } } catch { /* */ }
}
loadEnv('.env'); loadEnv('.env.local');

// ─── Parse CLI Arguments ─────────────────────────────────

function parseArgs(): { sourceId?: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let sourceId: string | undefined;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith('--source-id=')) {
      sourceId = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { sourceId, dryRun };
}

// ─── Constants ───────────────────────────────────────────

const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_PAGES = 50;
const SCRAPE_BATCH_SIZE = 3;
const FETCH_TIMEOUT_MS = 15_000;

// ─── Types ───────────────────────────────────────────────

interface DiscoveredArticle {
  title: string;
  url: string;
  summary: string | null;
  content: string;
  thumbnailUrl: string | null;
  wordCount: number;
}

interface DeepCrawlResult {
  source: string;
  pagesChecked: number;
  newArticles: number;
  error?: string;
}

// ─── Helper: extract domain ──────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ─── Helper: fetch raw HTML ──────────────────────────────

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// ─── BFS Deep Crawl for a single source ──────────────────

async function deepCrawlSource(
  sb: SupabaseClient,
  source: any,
  dryRun: boolean,
): Promise<DeepCrawlResult> {
  const sourceName = source.name;
  const sourceUrl = source.url;
  const config = source.config || {};
  const baseDomain = extractDomain(sourceUrl);

  const maxDepth = config.max_depth ?? DEFAULT_MAX_DEPTH;
  const maxPages = config.max_pages ?? DEFAULT_MAX_PAGES;
  const includePatterns: string[] = config.include_patterns || [];
  const excludePatterns: string[] = config.exclude_patterns || [];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍 Deep Crawl: ${sourceName}`);
  console.log(`   URL: ${sourceUrl}`);
  console.log(`   Max Depth: ${maxDepth}, Max Pages: ${maxPages}`);

  const visited = new Set<string>();
  const discoveredArticles: DiscoveredArticle[] = [];
  let pagesChecked = 0;

  // BFS queue: [url, depth]
  type QueueItem = { url: string; depth: number };
  const queue: QueueItem[] = [{ url: sourceUrl, depth: 0 }];
  visited.add(sourceUrl);

  try {
    while (queue.length > 0 && pagesChecked < maxPages) {
      const current = queue.shift()!;
      pagesChecked++;

      console.log(`   🌐 [${pagesChecked}/${maxPages}] Depth ${current.depth}: ${current.url.substring(0, 80)}...`);

      // Fetch the page HTML
      const html = await fetchHTML(current.url);
      if (!html) {
        console.log(`      ✗ Failed to fetch`);
        continue;
      }

      // Discover new links for BFS (only if we haven't reached max depth)
      if (current.depth < maxDepth) {
        const links = discoverLinks(html, current.url, baseDomain);

        for (const link of links) {
          if (visited.has(link)) continue;
          visited.add(link);

          // Apply include/exclude patterns from source config
          if (includePatterns.length > 0) {
            const matchesInclude = includePatterns.some(p => {
              try { return new RegExp(p, 'i').test(link); } catch { return false; }
            });
            if (!matchesInclude) continue;
          }

          if (excludePatterns.length > 0) {
            const matchesExclude = excludePatterns.some(p => {
              try { return new RegExp(p, 'i').test(link); } catch { return false; }
            });
            if (matchesExclude) continue;
          }

          queue.push({ url: link, depth: current.depth + 1 });
        }
      }

      // Check if current page is an article (skip root page analysis unless it matches)
      if (current.depth === 0 && !isArticleUrl(current.url, baseDomain)) {
        continue;
      }
      if (current.depth > 0 && !isArticleUrl(current.url, baseDomain)) {
        continue;
      }

      // Scrape current page with Readability
      const scraped = await scrapeWithReadability(current.url);
      if (!scraped || !scraped.textContent) continue;

      // Filter: must have enough words to be an article
      const wc = countWords(scraped.textContent);
      if (wc < MIN_ARTICLE_WORDS) {
        continue;
      }

      // Title quality check
      const title = scraped.title || '';
      if (title.length < 10) continue;

      // Extract thumbnail from metadata
      const meta = extractArticleMetadata(html);

      // Summary: first meaningful paragraph
      const paragraphs = scraped.textContent
        .split('\n\n')
        .filter(p => p.trim().length > 30);
      const summary = paragraphs.length > 0
        ? paragraphs[0].substring(0, 300)
        : (scraped.excerpt || null);

      discoveredArticles.push({
        title,
        url: current.url,
        summary,
        content: scraped.textContent.substring(0, MAX_CONTENT_LENGTH),
        thumbnailUrl: meta.thumbnailUrl || null,
        wordCount: wc,
      });

      console.log(`      📄 Article: ${title.substring(0, 60)}... (${wc} words)`);
    }

    console.log(`\n   📋 Checked ${pagesChecked} pages, discovered ${discoveredArticles.length} articles`);

    // ── Dry run → log only ───────────────────────────
    if (dryRun) {
      console.log(`   🔍 [DRY RUN] Would upsert ${discoveredArticles.length} articles:`);
      for (const a of discoveredArticles.slice(0, 10)) {
        console.log(`      • ${a.title.substring(0, 70)} (${a.wordCount} words)`);
      }
      if (discoveredArticles.length > 10) {
        console.log(`      ... and ${discoveredArticles.length - 10} more`);
      }
      return { source: sourceName, pagesChecked, newArticles: discoveredArticles.length };
    }

    // ── Upsert to DB ─────────────────────────────────
    let newCount = 0;

    if (discoveredArticles.length > 0) {
      const now = new Date().toISOString();
      const rows = discoveredArticles.map(a => ({
        title: a.title,
        url: a.url,
        source_id: source.id,
        summary: a.summary,
        content: a.content,
        thumbnail_url: a.thumbnailUrl,
        published_at: null, // Deep crawl can't reliably extract dates
        language: source.language || 'en',
        status: 'pending' as const,
        updated_at: now,
      }));

      // Upsert in batches to avoid payload limits
      const BATCH_SIZE = 20;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { data, error } = await sb
          .from('tech_articles')
          .upsert(batch, { onConflict: 'url', ignoreDuplicates: true })
          .select('id');

        if (error) {
          console.log(`      ❌ DB upsert error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${error.message}`);
        } else {
          newCount += data?.length || 0;
        }
      }

      console.log(`   💾 Upserted ${newCount} new articles`);
    }

    // ── Update source metadata ───────────────────────
    await sb
      .from('tech_sources')
      .update({
        last_crawled_at: new Date().toISOString(),
        article_count: (source.article_count || 0) + newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);

    console.log(`   ✅ ${sourceName}: +${newCount} articles discovered`);
    return { source: sourceName, pagesChecked, newArticles: newCount };

  } catch (e: any) {
    console.log(`   ❌ ${sourceName}: ${e.message}`);
    return { source: sourceName, pagesChecked, newArticles: 0, error: e.message };
  }
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const { sourceId, dryRun } = parseArgs();

  console.log('═'.repeat(60));
  console.log('🔍 ConTech Intelligence Hub — Weekly BFS Deep Crawler');
  console.log(`   Time: ${new Date().toISOString()}`);
  if (dryRun) console.log('   Mode: DRY RUN (discovery only, no DB writes)');
  if (sourceId) console.log(`   Filter: source_id = ${sourceId}`);
  console.log('═'.repeat(60));

  // Create Supabase client
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // Fetch deep_crawl / web sources
  let query = sb.from('tech_sources').select('*').eq('is_active', true);
  if (sourceId) {
    query = query.eq('id', sourceId);
  } else {
    query = query.in('type', ['deep_crawl', 'web']);
  }

  const { data: sources, error: srcErr } = await query;
  if (srcErr) {
    console.error(`❌ Failed to fetch sources: ${srcErr.message}`);
    process.exit(1);
  }
  if (!sources || sources.length === 0) {
    console.log('⚠ No deep crawl sources found. Add sources with type="deep_crawl" in TechSourceManager.');
    return;
  }

  console.log(`\n📋 Found ${sources.length} sources for deep crawl\n`);

  // Deep crawl each source
  let totalNew = 0;
  let totalPages = 0;
  const results: DeepCrawlResult[] = [];

  for (const source of sources) {
    const result = await deepCrawlSource(sb, source, dryRun);
    results.push(result);
    totalNew += result.newArticles;
    totalPages += result.pagesChecked;
  }

  // ── Print Summary ──────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 DEEP CRAWL SUMMARY');
  console.log(`   Sources crawled:       ${sources.length}`);
  console.log(`   Total pages checked:   ${totalPages}`);
  console.log(`   New articles found:    ${totalNew}`);
  console.log('═'.repeat(60));

  for (const r of results) {
    const status = r.error ? '✗' : '✓';
    const errorMsg = r.error ? ` — ERROR: ${r.error}` : '';
    console.log(`   ${status} ${r.source.padEnd(35)} ${r.pagesChecked} pages → ${r.newArticles} articles${errorMsg}`);
  }

  console.log(`\n→ Tiếp theo: npx tsx scripts/process-pending.ts để phân tích AI.\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
