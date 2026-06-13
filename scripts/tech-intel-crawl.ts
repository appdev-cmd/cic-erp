/**
 * CIC ERP — ConTech Intelligence Hub: Daily RSS Crawler CLI
 * ===========================================================
 *
 * TypeScript replacement for crawl4ai_scraper.py.
 * Runs locally (no Vercel, no Crawl4AI, no browser dependency).
 *
 * Pipeline:
 *   1. Load .env → create Supabase client
 *   2. Fetch active sources (rss, google_news, web)
 *   3. Parse RSS feeds via fetchRSS()
 *   4. Filter spam/junk via isSpamOrJunk()
 *   5. Upsert new articles to tech_articles (dedup by url)
 *   6. Auto-scrape missing content via scrapeWithReadability()
 *   7. Update source metadata (last_crawled_at, article_count)
 *
 * Usage:
 *   npx tsx scripts/tech-intel-crawl.ts                # Crawl all active sources
 *   npx tsx scripts/tech-intel-crawl.ts --source-id=X  # Crawl specific source
 *   npx tsx scripts/tech-intel-crawl.ts --dry-run       # Parse RSS only, no DB write
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fetchRSS, isSpamOrJunk } from '../api/tech-intel/crawl';
import { scrapeWithReadability, extractArticleMetadata, MAX_CONTENT_LENGTH } from '../api/tech-intel/scraper';
import { isGoogleNewsUrl, decodeGoogleNewsUrlSync } from '../api/tech-intel/googleNewsDecoder';

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

const MAX_SCRAPE_PER_SOURCE = 15;
const MIN_CONTENT_LENGTH = 200;
const SCRAPE_BATCH_SIZE = 3;

// ─── Crawl a single source ──────────────────────────────

interface CrawlResult {
  source: string;
  newArticles: number;
  scraped: number;
  error?: string;
}

async function crawlSource(
  sb: SupabaseClient,
  source: any,
  dryRun: boolean,
): Promise<CrawlResult> {
  const sourceName = source.name;
  const sourceType = source.type || 'rss';

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📡 Source: ${sourceName} (${sourceType})`);
  console.log(`   URL: ${source.url}`);

  try {
    // ── Step 1: Parse RSS ──────────────────────────────
    let articles: Awaited<ReturnType<typeof fetchRSS>>;

    if (sourceType === 'rss' || sourceType === 'google_news') {
      articles = await fetchRSS(source.url);
    } else if (sourceType === 'web') {
      // Web sources: treat the source URL itself as a single article
      articles = [{
        title: sourceName,
        url: source.url,
        summary: undefined,
        content: undefined,
        thumbnailUrl: undefined,
        publishedAt: undefined,
      }];
    } else {
      console.log(`   ⏭ Skipping source type: ${sourceType}`);
      return { source: sourceName, newArticles: 0, scraped: 0 };
    }

    // ── Step 2: Filter spam/junk ───────────────────────
    const clean = articles.filter(a => !isSpamOrJunk(a.title, a.url));
    console.log(`   📋 Parsed ${articles.length} entries, ${clean.length} after filtering`);

    if (clean.length === 0) {
      return { source: sourceName, newArticles: 0, scraped: 0 };
    }

    // ── Step 3: Dry run → log and skip DB write ────────
    if (dryRun) {
      console.log(`   🔍 [DRY RUN] Would upsert ${clean.length} articles:`);
      for (const a of clean.slice(0, 5)) {
        console.log(`      • ${a.title.substring(0, 80)}`);
      }
      if (clean.length > 5) console.log(`      ... and ${clean.length - 5} more`);
      return { source: sourceName, newArticles: clean.length, scraped: 0 };
    }

    // ── Step 4: Prepare rows and upsert to DB ──────────
    const rows = clean.map(a => {
      // Clean summary: remove if it duplicates the title
      let summary = a.summary || null;
      if (summary) {
        const nt = a.title.replace(/\s+/g, '').toLowerCase();
        const ns = summary.replace(/\s+/g, '').toLowerCase();
        if (ns === nt || ns.startsWith(nt) || nt.startsWith(ns)) {
          summary = null;
        }
      }

      // Decode Google News URLs to original article URLs (sync/fast path)
      let url = a.url;
      if (isGoogleNewsUrl(url)) {
        url = decodeGoogleNewsUrlSync(url) || url;
      }

      return {
        title: a.title,
        url,
        source_id: source.id,
        summary,
        content: a.content || null,
        thumbnail_url: a.thumbnailUrl,
        published_at: a.publishedAt,
        language: source.language || 'en',
        status: 'pending' as const,
      };
    });

    const { data: inserted, error: insertErr } = await sb
      .from('tech_articles')
      .upsert(rows, { onConflict: 'url', ignoreDuplicates: true })
      .select('id, url, title, summary, content');

    if (insertErr) {
      console.log(`   ❌ DB upsert error: ${insertErr.message}`);
      return { source: sourceName, newArticles: 0, scraped: 0, error: insertErr.message };
    }

    const newCount = inserted?.length || 0;

    // ── Step 5: Auto-scrape content for articles missing content ──
    // Skip Google News URLs that couldn't be decoded
    const toScrape = (inserted || [])
      .filter((a: any) =>
        !a.url.includes('news.google.com') &&
        (!a.content || a.content.length < MIN_CONTENT_LENGTH)
      )
      .slice(0, MAX_SCRAPE_PER_SOURCE);

    let scrapedCount = 0;

    if (toScrape.length > 0) {
      console.log(`   🔧 Scraping content for ${toScrape.length} articles...`);

      // Process in batches of SCRAPE_BATCH_SIZE with Promise.allSettled
      for (let i = 0; i < toScrape.length; i += SCRAPE_BATCH_SIZE) {
        const batch = toScrape.slice(i, i + SCRAPE_BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (a: any) => {
            const scraped = await scrapeWithReadability(a.url);
            if (scraped && scraped.textContent && scraped.textContent.length > 50) {
              const update: Record<string, string> = {
                content: scraped.textContent.substring(0, MAX_CONTENT_LENGTH),
              };

              // Use thumbnail from metadata if available
              if (!a.thumbnail_url) {
                // Re-fetch HTML to extract metadata (scrapeWithReadability doesn't return raw HTML)
                // Instead, use the Readability excerpt as summary if current summary is empty/duplicate
                if (scraped.excerpt && scraped.excerpt.length > 20) {
                  const isDuplicate = !a.summary ||
                    a.summary === a.title ||
                    a.summary.replace(/\s+/g, '').toLowerCase() === a.title.replace(/\s+/g, '').toLowerCase();
                  if (isDuplicate) {
                    update.summary = scraped.excerpt.substring(0, 300);
                  }
                }
              }

              await sb.from('tech_articles').update(update).eq('id', a.id);
              scrapedCount++;
              console.log(`      ✓ ${a.title.substring(0, 60)}... (${scraped.textContent.length} chars)`);
            }
          })
        );

        // Log failures
        for (const r of results) {
          if (r.status === 'rejected') {
            console.log(`      ✗ Scrape failed: ${r.reason?.message || r.reason}`);
          }
        }
      }
    }

    // Log Google News articles that were skipped
    const googleNewsCount = (inserted || []).filter((a: any) => a.url.includes('news.google.com')).length;
    if (googleNewsCount > 0) {
      console.log(`   ℹ ${googleNewsCount} Google News articles (title-only analysis)`);
    }

    // ── Step 6: Update source metadata ─────────────────
    await sb
      .from('tech_sources')
      .update({
        last_crawled_at: new Date().toISOString(),
        article_count: (source.article_count || 0) + newCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);

    console.log(`   ✅ ${sourceName}: +${newCount} articles (scraped content: ${scrapedCount})`);
    return { source: sourceName, newArticles: newCount, scraped: scrapedCount };

  } catch (e: any) {
    console.log(`   ❌ ${sourceName}: ${e.message}`);
    return { source: sourceName, newArticles: 0, scraped: 0, error: e.message };
  }
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const { sourceId, dryRun } = parseArgs();

  console.log('═'.repeat(60));
  console.log('🚀 ConTech Intelligence Hub — Daily RSS Crawler');
  console.log(`   Time: ${new Date().toISOString()}`);
  if (dryRun) console.log('   Mode: DRY RUN (no DB writes)');
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

  // Fetch active sources
  let query = sb.from('tech_sources').select('*').eq('is_active', true);
  if (sourceId) {
    query = query.eq('id', sourceId);
  } else {
    query = query.in('type', ['rss', 'google_news', 'web']);
  }

  const { data: sources, error: srcErr } = await query;
  if (srcErr) {
    console.error(`❌ Failed to fetch sources: ${srcErr.message}`);
    process.exit(1);
  }
  if (!sources || sources.length === 0) {
    console.log('⚠ No active sources found.');
    return;
  }

  console.log(`\n📋 Found ${sources.length} active sources to crawl\n`);

  // Crawl each source
  let totalNew = 0;
  let totalScraped = 0;
  const results: CrawlResult[] = [];

  for (const source of sources) {
    const result = await crawlSource(sb, source, dryRun);
    results.push(result);
    totalNew += result.newArticles;
    totalScraped += result.scraped;
  }

  // ── Print Summary ──────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 CRAWL SUMMARY');
  console.log(`   Sources crawled:  ${sources.length}`);
  console.log(`   New articles:     ${totalNew}`);
  console.log(`   Content scraped:  ${totalScraped}`);
  console.log('═'.repeat(60));

  for (const r of results) {
    const status = r.error ? '✗' : '✓';
    const errorMsg = r.error ? ` — ERROR: ${r.error}` : '';
    console.log(`   ${status} ${r.source.padEnd(35)} +${r.newArticles} new, ${r.scraped} scraped${errorMsg}`);
  }

  console.log(`\n→ Tiếp theo: npx tsx scripts/process-pending.ts để phân tích AI.\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
